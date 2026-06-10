// backend/src/routes/portal.js
// Public client portal — authenticated by portal_token (UUID), no JWT needed

const router = require('express').Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { generatePDF } = require('./finance');
const { prepareFileFields, serveFile } = require('../utils/localFileStorage');

// ── Multer: memory storage (no disk, works on Vercel) ──────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images (JPEG, PNG, WebP) and PDFs are allowed'));
  },
});

// ── Helper: resolve client from token ──────────────────────────
async function resolveClient(token) {
  const { rows } = await pool.query(
    'SELECT * FROM clients WHERE portal_token = $1',
    [token]
  );
  return rows[0] || null;
}

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/manifest — PWA web app manifest for this client
// Allows the client portal to be installed as a standalone PWA independently
// from the main management app, with the client's company name.
// ══════════════════════════════════════════════════════════════
router.get('/:token/manifest', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    const name = client ? `${client.company_name} — My Portal` : 'Axialogy Client Portal';
    const shortName = client ? client.company_name : 'Client Portal';
    const token = req.params.token;

    const manifest = {
      name,
      short_name: shortName,
      description: 'Your dedicated Axialogy client portal — invoices, quotes, tasks and documents.',
      theme_color: '#6366f1',
      background_color: '#f8fafc',
      display: 'standalone',
      orientation: 'portrait',
      start_url: `/portal/${token}`,
      scope: `/portal/${token}`,
      icons: [
        { src: '/icons/logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icons/logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-cache');
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/auth-check — check if client has registered
// Returns: { has_credentials, company_name }
// ══════════════════════════════════════════════════════════════
router.get('/:token/auth-check', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });
    res.json({
      has_credentials: !!client.portal_username,
      company_name: client.company_name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/portal/:token/register — client creates portal account
// Body: { username, password }
// ══════════════════════════════════════════════════════════════
router.post('/:token/register', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });
    if (client.portal_username) {
      return res.status(400).json({ error: 'Account already exists. Please log in.' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check username uniqueness across all clients
    const { rows: existing } = await pool.query(
      'SELECT id FROM clients WHERE portal_username = $1 AND id != $2',
      [username.trim(), client.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already taken. Please choose another.' });
    }

    const hash = await bcrypt.hash(password, 12);

    await pool.query(
      `UPDATE clients
       SET portal_username = $1, portal_password_hash = $2, portal_plain_password = $3
       WHERE id = $4`,
      [username.trim(), hash, password, client.id]
    );

    res.json({ success: true, username: username.trim() });
  } catch (err) {
    console.error('[Portal register]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/portal/:token/login — client logs in to portal
// Body: { username, password }
// ══════════════════════════════════════════════════════════════
router.post('/:token/login', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });
    if (!client.portal_username) {
      return res.status(400).json({ error: 'No account found. Please register first.' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (client.portal_username !== username.trim()) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, client.portal_password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({ success: true, username: client.portal_username });
  } catch (err) {
    console.error('[Portal login]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PUT /api/portal/:token/credentials — update username and/or password
// Body: { current_password, new_username?, new_password? }
// ══════════════════════════════════════════════════════════════
router.put('/:token/credentials', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });
    if (!client.portal_username) {
      return res.status(400).json({ error: 'No account found. Please register first.' });
    }

    const { current_password, new_username, new_password } = req.body;
    if (!current_password) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    if (!new_username && !new_password) {
      return res.status(400).json({ error: 'Provide a new username or new password' });
    }

    // Verify current password
    const valid = await bcrypt.compare(current_password, client.portal_password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    let updatedUsername = client.portal_username;
    let updatedHash = client.portal_password_hash;
    let updatedPlain = client.portal_plain_password;

    // Validate + prepare new username
    if (new_username && new_username.trim() !== client.portal_username) {
      if (new_username.trim().length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      // Check uniqueness
      const { rows: taken } = await pool.query(
        'SELECT id FROM clients WHERE portal_username = $1 AND id != $2',
        [new_username.trim(), client.id]
      );
      if (taken.length > 0) {
        return res.status(400).json({ error: 'Username already taken. Please choose another.' });
      }
      updatedUsername = new_username.trim();
    }

    // Validate + hash new password
    if (new_password) {
      if (new_password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updatedHash = await bcrypt.hash(new_password, 12);
      updatedPlain = new_password;
    }

    await pool.query(
      `UPDATE clients
       SET portal_username = $1, portal_password_hash = $2, portal_plain_password = $3
       WHERE id = $4`,
      [updatedUsername, updatedHash, updatedPlain, client.id]
    );

    res.json({ success: true, username: updatedUsername });
  } catch (err) {
    console.error('[Portal credentials update]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token — main profile (info + wallet + tasks + activity)
// ══════════════════════════════════════════════════════════════
router.get('/:token', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    // Tasks (sanitized — no internal notes)
    const { rows: tasks } = await pool.query(`
      SELECT
        t.id, t.title, t.status, t.progress_pct, t.deadline, t.service_type,
        (SELECT json_agg(json_build_object('name', u.name))
         FROM users u WHERE u.id = ANY(t.assignee_ids)) AS assignees
      FROM tasks t
      WHERE t.client_id = $1
      ORDER BY t.deadline ASC NULLS LAST, t.created_at DESC
    `, [client.id]);

    // Activity log (last 20, description + date only)
    const { rows: activity } = await pool.query(`
      SELECT description, created_at
      FROM activity_log
      WHERE client_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [client.id]);

    res.json({
      company_name: client.company_name,
      contact_name: client.contact_name,
      contact_email: client.contact_email,
      contact_phone: client.contact_phone,
      is_active: client.is_active,
      wallet_balance: client.wallet_balance,
      tasks,
      activity,
    });
  } catch (err) {
    console.error('[Portal GET profile]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/quotes — list quotations visible in portal
// ══════════════════════════════════════════════════════════════
router.get('/:token/quotes', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const { rows } = await pool.query(`
      SELECT q.id, q.quote_number, q.status, q.created_at,
        COALESCE(SUM(li.quantity * li.unit_price), 0) AS grand_total
      FROM quotations q
      LEFT JOIN quotation_line_items li ON li.quotation_id = q.id
      WHERE q.client_id = $1 AND q.portal_visible = TRUE
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `, [client.id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/quotes/:id/pdf
// ══════════════════════════════════════════════════════════════
router.get('/:token/quotes/:id/pdf', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const { rows: [quote] } = await pool.query(`
      SELECT q.*, c.company_name, c.contact_name, c.contact_email
      FROM quotations q
      JOIN clients c ON c.id = q.client_id
      WHERE q.id = $1 AND q.client_id = $2 AND q.portal_visible = TRUE
    `, [req.params.id, client.id]);

    if (!quote) return res.status(404).json({ error: 'Quotation not found or not yet sent' });

    const { rows: items } = await pool.query(
      'SELECT * FROM quotation_line_items WHERE quotation_id = $1 ORDER BY id',
      [req.params.id]
    );

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.quote_number}.pdf"`);
    doc.pipe(res);
    generatePDF(doc, 'QUOTATION', quote, items);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/invoices — list invoices visible in portal
// ══════════════════════════════════════════════════════════════
router.get('/:token/invoices', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const { rows } = await pool.query(`
      SELECT i.id, i.invoice_number, i.status, i.due_date, i.created_at,
        COALESCE(
          (SUM(li.quantity * li.unit_price))
          - (SUM(li.quantity * li.unit_price) * COALESCE(i.discount_pct, 0) / 100)
        , 0) AS grand_total,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS amount_paid
      FROM invoices i
      LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
      WHERE i.client_id = $1 AND i.portal_visible = TRUE
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, [client.id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/invoices/:id/pdf
// ══════════════════════════════════════════════════════════════
router.get('/:token/invoices/:id/pdf', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const { rows: [invoice] } = await pool.query(`
      SELECT i.*, c.company_name, c.contact_name, c.contact_email
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      WHERE i.id = $1 AND i.client_id = $2 AND i.portal_visible = TRUE
    `, [req.params.id, client.id]);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found or not yet sent' });

    const { rows: items } = await pool.query(
      'SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY id',
      [req.params.id]
    );

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
    doc.pipe(res);
    generatePDF(doc, 'INVOICE', invoice, items);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/documents — list client's own uploads
// ══════════════════════════════════════════════════════════════
router.get('/:token/documents', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const { rows: docs } = await pool.query(`
      SELECT cu.*,
        (SELECT json_agg(n ORDER BY n.created_at ASC)
         FROM client_upload_notes n WHERE n.upload_id = cu.id) AS notes
      FROM client_uploads cu
      WHERE cu.client_id = $1
      ORDER BY cu.uploaded_at DESC
    `, [client.id]);

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/portal/:token/upload — client uploads a file (stored in PostgreSQL)
// ══════════════════════════════════════════════════════════════
router.post('/:token/upload', upload.single('file'), async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { note } = req.body;
    const fields = prepareFileFields(req.file);

    // Store file binary in DB — no Supabase, no egress
    const { rows: [doc] } = await pool.query(`
      INSERT INTO client_uploads (client_id, file_name, file_url, file_type, note, file_data, file_size)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, client_id, file_name, file_type, note, file_size, uploaded_at
    `, [client.id, req.file.originalname, fields.file_url, req.file.mimetype, note || null, fields.file_data, fields.file_size]);

    res.status(201).json(doc);
  } catch (err) {
    console.error('[Portal Upload]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/documents/:uploadId/download — serve file from DB
// ══════════════════════════════════════════════════════════════
router.get('/:token/documents/:uploadId/download', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const { rows: [doc] } = await pool.query(
      'SELECT file_name, file_type, file_data, file_url FROM client_uploads WHERE id = $1 AND client_id = $2',
      [req.params.uploadId, client.id]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Prefer local binary data; fall back to redirect for old Supabase URLs
    if (doc.file_data) {
      return serveFile(res, doc.file_data, doc.file_type, doc.file_name);
    }
    if (doc.file_url) {
      return res.redirect(302, doc.file_url);
    }
    return res.status(404).json({ error: 'No file data available' });
  } catch (err) {
    console.error('[Portal Download]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/portal/:token/documents/:uploadId/notes — client adds a note
// ══════════════════════════════════════════════════════════════
router.post('/:token/documents/:uploadId/notes', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Note content is required' });

    // Verify the upload belongs to this client
    const { rows: [upload] } = await pool.query(
      'SELECT id FROM client_uploads WHERE id = $1 AND client_id = $2',
      [req.params.uploadId, client.id]
    );
    if (!upload) return res.status(404).json({ error: 'Document not found' });

    const { rows: [note] } = await pool.query(`
      INSERT INTO client_upload_notes (upload_id, author_type, content)
      VALUES ($1, 'client', $2)
      RETURNING *
    `, [req.params.uploadId, content.trim()]);

    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/qr — returns QR PNG (admin uses this)
// ══════════════════════════════════════════════════════════════
// (This endpoint is also usable publicly — no sensitive data exposed)
router.get('/:token/qr', async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const portalUrl = `${process.env.FRONTEND_URL || 'https://management.axialogy.com'}/portal/${req.params.token}`;
    const png = await QRCode.toBuffer(portalUrl, { width: 400, margin: 2 });

    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/portal/:token/notifications — list portal notifications
// ══════════════════════════════════════════════════════════════
router.get('/:token/notifications', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    const { rows } = await pool.query(`
      SELECT id, type, title, message, is_read, created_at
      FROM portal_notifications
      WHERE client_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [client.id]);

    const unread = rows.filter(n => !n.is_read).length;
    res.json({ notifications: rows, unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/portal/:token/notifications/:id/read — mark one read
// ══════════════════════════════════════════════════════════════
router.patch('/:token/notifications/:id/read', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    await pool.query(
      'UPDATE portal_notifications SET is_read = TRUE WHERE id = $1 AND client_id = $2',
      [req.params.id, client.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/portal/:token/notifications/read-all — mark all read
// ══════════════════════════════════════════════════════════════
router.patch('/:token/notifications/read-all', async (req, res) => {
  try {
    const client = await resolveClient(req.params.token);
    if (!client) return res.status(404).json({ error: 'Portal not found' });

    await pool.query(
      'UPDATE portal_notifications SET is_read = TRUE WHERE client_id = $1',
      [client.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

