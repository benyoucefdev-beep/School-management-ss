const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete, ROLE_SERVICE_TYPE, SPECIALIST_ROLES } = require('../middleware/rbac');
const { logActivity } = require('../services/activityLog');

router.use(authenticate);

// GET /api/clients
router.get('/', canView('clients'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, simple } = req.query;

    // Highly optimized lightweight query for dropdown lists (e.g., tasks page filters / modals)
    if (simple === 'true') {
      const { rows } = await pool.query(
        'SELECT id, company_name FROM clients ORDER BY company_name ASC'
      );
      return res.json({ data: rows });
    }

    const offset = (page - 1) * limit;

    // All roles with clients:view see ALL clients.
    // Per-operation access (create/edit/delete) is enforced by dedicated RBAC guards.
    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE (c.company_name ILIKE $1 OR c.contact_name ILIKE $1 OR c.contact_email ILIKE $1)`;
    }

    const query = `
      SELECT c.*, u.name AS manager_name,
        array_agg(DISTINCT cs.service_type) FILTER (WHERE cs.is_active = true) AS active_services,
        COUNT(*) OVER() AS total_count,
        EXISTS(
          SELECT 1 FROM tasks t 
          WHERE t.client_id = c.id 
            AND t.updated_at >= NOW() - INTERVAL '40 days'
        ) AS is_active
      FROM clients c
      LEFT JOIN users u ON u.id = c.assigned_manager_id
      LEFT JOIN client_services cs ON cs.client_id = c.id
      ${where}
      GROUP BY c.id, u.name
      ORDER BY c.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);

    const total = rows[0]?.total_count || 0;
    res.json({ data: rows, total: parseInt(total), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/clients/:id
router.get('/:id', canView('clients'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, u.name AS manager_name,
        EXISTS(
          SELECT 1 FROM tasks t 
          WHERE t.client_id = c.id 
            AND t.updated_at >= NOW() - INTERVAL '40 days'
        ) AS is_active
      FROM clients c
      LEFT JOIN users u ON u.id = c.assigned_manager_id
      WHERE c.id = $1
    `, [req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });

    const client = rows[0];

    const { rows: services } = await pool.query(
      'SELECT * FROM client_services WHERE client_id = $1 ORDER BY start_date DESC',
      [req.params.id]
    );
    client.services = services;

    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients (admin only in practice)
router.post('/', canCreate('clients'), async (req, res) => {
  const { company_name, contact_name, contact_email, contact_phone,
          assigned_manager_id, date_joined,
          student_phone, father_phone, date_of_birth, level, group_id } = req.body;
  if (!company_name) return res.status(400).json({ error: 'company_name is required' });

  try {
    const { rows } = await pool.query(`
      INSERT INTO clients (company_name, contact_name, contact_email, contact_phone,
                           assigned_manager_id, date_joined,
                           student_phone, father_phone, date_of_birth, level, group_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [company_name, contact_name, contact_email, contact_phone,
        assigned_manager_id || null, date_joined || null,
        student_phone||null, father_phone||null, date_of_birth||null, level||null, group_id||null]);

    await logActivity({
      clientId: rows[0].id,
      userId: req.user.id,
      actionType: 'client_created',
      description: `Student "${company_name}" created`,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clients/:id (admin only)
router.put('/:id', canEdit('clients'), async (req, res) => {
  const { company_name, contact_name, contact_email, contact_phone, assigned_manager_id, date_joined, client_status } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE clients
      SET company_name = COALESCE($1, company_name),
          contact_name = COALESCE($2, contact_name),
          contact_email = COALESCE($3, contact_email),
          contact_phone = COALESCE($4, contact_phone),
          assigned_manager_id = COALESCE($5, assigned_manager_id),
          date_joined = COALESCE($6, date_joined),
          client_status = COALESCE($8, client_status)
      WHERE id = $7
      RETURNING *
    `, [company_name, contact_name, contact_email, contact_phone, assigned_manager_id, date_joined, req.params.id, client_status || null]);

    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/:id/wallet-log — wallet movement history (read-only)
router.get('/:id/wallet-log', canView('clients'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT al.*, u.name AS user_name
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.client_id = $1
        AND al.action_type IN ('payment_received', 'ad_spend_logged', 'wallet_funded', 'invoice_overdue')
      ORDER BY al.created_at DESC
      LIMIT 100
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// DELETE /api/clients/:id (admin only)
router.delete('/:id', canDelete('clients'), async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    // Cascade deletes for all client dependencies
    const id = req.params.id;
    await db.query('DELETE FROM activity_log WHERE client_id = $1', [id]);
    await db.query('DELETE FROM client_notes WHERE client_id = $1', [id]);
    await db.query('DELETE FROM client_files WHERE client_id = $1', [id]);
    await db.query('DELETE FROM tasks WHERE client_id = $1', [id]);
    await db.query('DELETE FROM client_services WHERE client_id = $1', [id]);
    
    // Finance dependencies
    await db.query('DELETE FROM client_versements WHERE client_id = $1', [id]);
    await db.query('DELETE FROM transactions WHERE client_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM payments WHERE client_id = $1', [id]);
    await db.query(`DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE client_id = $1)`, [id]);
    await db.query('DELETE FROM invoices WHERE client_id = $1', [id]);
    await db.query(`DELETE FROM quotation_line_items WHERE quotation_id IN (SELECT id FROM quotations WHERE client_id = $1)`, [id]);
    await db.query('DELETE FROM quotations WHERE client_id = $1', [id]);
    
    // Ads wallet dependencies
    await db.query('DELETE FROM wallet_transactions WHERE client_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM wallet_deposits WHERE client_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM ad_spend_entries WHERE client_id = $1', [id]).catch(() => {});
    await db.query(`DELETE FROM ad_campaigns WHERE client_id = $1`, [id]).catch(() => {});
    await db.query('DELETE FROM client_ads_wallets WHERE client_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM ads_spend_logs WHERE client_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM ads_budgets WHERE client_id = $1', [id]).catch(() => {});

    await db.query('DELETE FROM clients WHERE id = $1', [id]);
    
    await db.query('COMMIT');
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// ── CLIENT SERVICES ────────────────────────────────────────────

router.get('/:id/services', canView('clients'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM client_services WHERE client_id = $1 ORDER BY start_date DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/services', canCreate('clients'), async (req, res) => {
  const { service_type, start_date, delivery_status } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO client_services (client_id, service_type, start_date, delivery_status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.id, service_type, start_date, delivery_status || 'on_track']);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/services/:svcId', canEdit('clients'), async (req, res) => {
  const { delivery_status, is_active } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE client_services
      SET delivery_status = COALESCE($1, delivery_status),
          is_active = COALESCE($2, is_active)
      WHERE id = $3 AND client_id = $4
      RETURNING *
    `, [delivery_status, is_active, req.params.svcId, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENT NOTES ────────────────────────────────────────────────

router.get('/:id/notes', canView('clients'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cn.*, u.name AS author_name
      FROM client_notes cn
      LEFT JOIN users u ON u.id = cn.author_id
      WHERE cn.client_id = $1
      ORDER BY cn.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/notes', canCreate('clients'), async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO client_notes (client_id, author_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.id, req.user.id, content]);

    await logActivity({
      clientId: req.params.id,
      userId: req.user.id,
      actionType: 'note_added',
      description: `Internal note added`,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/notes/:noteId', canDelete('clients'), async (req, res) => {
  try {
    await pool.query('DELETE FROM client_notes WHERE id = $1 AND client_id = $2', [req.params.noteId, req.params.id]);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENT FILES ────────────────────────────────────────────────

router.get('/:id/files', canView('clients'), async (req, res) => {
  const { folder } = req.query;
  try {
    let q = 'SELECT cf.*, u.name AS uploader_name FROM client_files cf LEFT JOIN users u ON u.id = cf.uploaded_by WHERE cf.client_id = $1';
    const params = [req.params.id];
    if (folder) { q += ` AND cf.folder = $2`; params.push(folder); }
    q += ' ORDER BY cf.uploaded_at DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/files', canCreate('clients'), async (req, res) => {
  const { folder, file_name, file_url } = req.body;
  if (!folder || !file_name || !file_url)
    return res.status(400).json({ error: 'folder, file_name, file_url are required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO client_files (client_id, folder, file_name, file_url, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.params.id, folder, file_name, file_url, req.user.id]);

    await logActivity({
      clientId: req.params.id,
      userId: req.user.id,
      actionType: 'file_uploaded',
      description: `File "${file_name}" uploaded to ${folder}`,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/files/:fileId', canDelete('clients'), async (req, res) => {
  try {
    await pool.query('DELETE FROM client_files WHERE id = $1 AND client_id = $2', [req.params.fileId, req.params.id]);
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ACTIVITY LOG ────────────────────────────────────────────────

router.get('/:id/activity', canView('clients'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT al.*, u.name AS user_name
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.client_id = $1
      ORDER BY al.created_at DESC
      LIMIT 50
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/health-signals', canView('clients'), async (req, res) => {
  try {
    const result = await calculateClientHealthWithSignals(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENT PORTAL — Admin-side endpoints ───────────────────────

// GET /api/clients/:id/qr — generate QR code PNG for this client's portal
router.get('/:id/qr', canView('clients'), async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const { rows: [client] } = await pool.query(
      'SELECT portal_token FROM clients WHERE id = $1',
      [req.params.id]
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const portalUrl = `${process.env.FRONTEND_URL || 'https://management.axialogy.com'}/portal/${client.portal_token}`;
    const png = await QRCode.toBuffer(portalUrl, { width: 400, margin: 2 });

    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/:id/uploads — list files clients sent via portal
router.get('/:id/uploads', canView('clients'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cu.*,
        (SELECT json_agg(n ORDER BY n.created_at ASC)
         FROM client_upload_notes n WHERE n.upload_id = cu.id) AS notes
      FROM client_uploads cu
      WHERE cu.client_id = $1
      ORDER BY cu.uploaded_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/:id/uploads/:uploadId/notes — admin replies to a client document
router.post('/:id/uploads/:uploadId/notes', canCreate('clients'), async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  try {
    const { rows: [note] } = await pool.query(`
      INSERT INTO client_upload_notes (upload_id, author_type, content)
      VALUES ($1, 'admin', $2)
      RETURNING *
    `, [req.params.uploadId, content.trim()]);
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
