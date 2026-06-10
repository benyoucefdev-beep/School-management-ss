const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { prepareFileFields, serveFile } = require('../utils/localFileStorage');

// Memory-based upload (no disk, works on Vercel/serverless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images (JPEG, PNG, WebP) and PDFs are allowed'));
  },
});

// ── Helper: resolve supplier by portal_token ─────────────────────
async function resolveSupplier(token) {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.contact_name, s.contact_email, s.contact_phone,
            s.portal_token, s.portal_username, s.portal_password_hash, s.portal_plain_password,
            s.country, s.payment_terms,
            st.name AS type_name
     FROM suppliers s
     LEFT JOIN supplier_types st ON st.id = s.supplier_type_id
     WHERE s.portal_token = $1`,
    [token]
  );
  return rows[0] || null;
}

// ══════════════════════════════════════════════════════════════
// GET /api/supplier-portal/:token/manifest — PWA manifest for this supplier
// Allows the supplier portal to be installed as a standalone PWA independently
// from the main management app, with the supplier's name.
// ══════════════════════════════════════════════════════════════
router.get('/:token/manifest', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    const name = supplier ? `${supplier.name} — Supplier Portal` : 'Axialogy Supplier Portal';
    const shortName = supplier ? supplier.name : 'Supplier Portal';
    const token = req.params.token;

    const manifest = {
      name,
      short_name: shortName,
      description: 'Your dedicated Axialogy supplier portal — transactions, payments and documents.',
      theme_color: '#10b981',
      background_color: '#f8fafc',
      display: 'standalone',
      orientation: 'portrait',
      start_url: `/supplier-portal/${token}`,
      scope: `/supplier-portal/${token}`,
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
// GET /api/supplier-portal/:token/auth-check
// Returns has_credentials + supplier name (for the auth screens)
// ══════════════════════════════════════════════════════════════
router.get('/:token/auth-check', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });
    res.json({
      has_credentials: !!supplier.portal_username,
      supplier_name: supplier.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/supplier-portal/:token/register
// Body: { username, password }
// ══════════════════════════════════════════════════════════════
router.post('/:token/register', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });
    if (supplier.portal_username) {
      return res.status(400).json({ error: 'Account already exists. Please log in.' });
    }

    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (username.trim().length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Check username uniqueness
    const { rows: taken } = await pool.query(
      'SELECT id FROM suppliers WHERE portal_username = $1',
      [username.trim()]
    );
    if (taken.length > 0) return res.status(400).json({ error: 'Username already taken. Please choose another.' });

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `UPDATE suppliers
       SET portal_username = $1, portal_password_hash = $2, portal_plain_password = $3
       WHERE id = $4`,
      [username.trim(), hash, password, supplier.id]
    );

    res.json({ success: true, username: username.trim() });
  } catch (err) {
    console.error('[Supplier portal register]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/supplier-portal/:token/login
// Body: { username, password }
// ══════════════════════════════════════════════════════════════
router.post('/:token/login', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });
    if (!supplier.portal_username) {
      return res.status(400).json({ error: 'No account found. Please register first.' });
    }

    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    if (username.trim().toLowerCase() !== supplier.portal_username.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, supplier.portal_password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    res.json({ success: true, username: supplier.portal_username });
  } catch (err) {
    console.error('[Supplier portal login]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PUT /api/supplier-portal/:token/credentials
// Body: { current_password, new_username?, new_password? }
// ══════════════════════════════════════════════════════════════
router.put('/:token/credentials', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });
    if (!supplier.portal_username) {
      return res.status(400).json({ error: 'No account found. Please register first.' });
    }

    const { current_password, new_username, new_password } = req.body;
    if (!current_password) return res.status(400).json({ error: 'Current password is required' });
    if (!new_username && !new_password) return res.status(400).json({ error: 'Provide a new username or new password' });

    const valid = await bcrypt.compare(current_password, supplier.portal_password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    let updatedUsername = supplier.portal_username;
    let updatedHash = supplier.portal_password_hash;
    let updatedPlain = supplier.portal_plain_password;

    if (new_username && new_username.trim() !== supplier.portal_username) {
      if (new_username.trim().length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
      const { rows: taken } = await pool.query(
        'SELECT id FROM suppliers WHERE portal_username = $1 AND id != $2',
        [new_username.trim(), supplier.id]
      );
      if (taken.length > 0) return res.status(400).json({ error: 'Username already taken. Please choose another.' });
      updatedUsername = new_username.trim();
    }

    if (new_password) {
      if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      updatedHash = await bcrypt.hash(new_password, 12);
      updatedPlain = new_password;
    }

    await pool.query(
      `UPDATE suppliers SET portal_username=$1, portal_password_hash=$2, portal_plain_password=$3 WHERE id=$4`,
      [updatedUsername, updatedHash, updatedPlain, supplier.id]
    );

    res.json({ success: true, username: updatedUsername });
  } catch (err) {
    console.error('[Supplier portal credentials]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/supplier-portal/:token — main portal data
// ══════════════════════════════════════════════════════════════
router.get('/:token', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });

    // 1. Fetch all non-cancelled transactions
    const { rows: txRows } = await pool.query(`
      SELECT id, total_amount, status, payment_method, due_date, notes, quantity, created_at
      FROM supplier_transactions
      WHERE supplier_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [supplier.id]);

    // 2. Fetch total paid versements per transaction (one query, no subqueries)
    const { rows: versRows } = await pool.query(`
      SELECT transaction_id, SUM(amount) AS paid_amount
      FROM supplier_versements
      WHERE supplier_id = $1 AND status = 'paid'
      GROUP BY transaction_id
    `, [supplier.id]);

    // Build paid-per-transaction map
    const paidMap = {};
    for (const v of versRows) paidMap[v.transaction_id] = parseFloat(v.paid_amount || 0);

    // Enrich transactions with computed balance_remaining
    const transactions = txRows.map(tx => {
      const paid = paidMap[tx.id] || 0;
      return {
        ...tx,
        total_amount: parseFloat(tx.total_amount),
        balance_remaining: Math.max(0, parseFloat(tx.total_amount) - paid),
        paid_amount: paid,
      };
    });

    // 3. Compute summary in JS
    const nonCancelled = transactions.filter(t => t.status !== 'cancelled');
    const totalOwed    = nonCancelled.reduce((s, t) => s + t.total_amount, 0);
    const totalPaid    = nonCancelled.reduce((s, t) => s + t.paid_amount, 0);
    const balancePending = nonCancelled
      .filter(t => t.status !== 'paid')
      .reduce((s, t) => s + t.balance_remaining, 0);

    // 4. Unread notification count
    let unreadNotifs = 0;
    try {
      const { rows: [nc] } = await pool.query(
        `SELECT COUNT(*) AS unread FROM supplier_portal_notifications WHERE supplier_id = $1 AND is_read = FALSE`,
        [supplier.id]
      );
      unreadNotifs = parseInt(nc?.unread || 0);
    } catch (_) { /* table may not exist on older deploys */ }

    res.json({
      id:            supplier.id,
      name:          supplier.name,
      contact_name:  supplier.contact_name,
      contact_email: supplier.contact_email,
      contact_phone: supplier.contact_phone,
      type_name:     supplier.type_name,
      country:       supplier.country,
      payment_terms: supplier.payment_terms,
      summary: { total_owed: totalOwed, total_paid: totalPaid, balance_pending: balancePending },
      transactions,
      unread_notifications: unreadNotifs,
    });
  } catch (err) {
    console.error('[SupplierPortal GET /:token]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/supplier-portal/:token/notifications
// ══════════════════════════════════════════════════════════════
router.get('/:token/notifications', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });

    const { rows } = await pool.query(`
      SELECT id, type, title, message, is_read, created_at
      FROM supplier_portal_notifications
      WHERE supplier_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [supplier.id]);

    const unread = rows.filter(n => !n.is_read).length;
    res.json({ notifications: rows, unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/supplier-portal/:token/notifications/:id/read
// ══════════════════════════════════════════════════════════════
router.patch('/:token/notifications/:id/read', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });
    await pool.query(
      'UPDATE supplier_portal_notifications SET is_read = TRUE WHERE id = $1 AND supplier_id = $2',
      [req.params.id, supplier.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/supplier-portal/:token/notifications/read-all
// ══════════════════════════════════════════════════════════════
router.patch('/:token/notifications/read-all', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });
    await pool.query(
      'UPDATE supplier_portal_notifications SET is_read = TRUE WHERE supplier_id = $1',
      [supplier.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/supplier-portal/:token/documents
// Documents that STAFF uploaded and shared with this supplier
// ══════════════════════════════════════════════════════════════
router.get('/:token/documents', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });

    const { rows } = await pool.query(`
      SELECT
        sd.id, sd.file_name, sd.file_url, sd.folder, sd.note, sd.uploaded_at,
        sd.transaction_id,
        (SELECT json_agg(n ORDER BY n.created_at ASC)
         FROM supplier_document_notes n WHERE n.doc_id = sd.id) AS notes
      FROM supplier_documents sd
      WHERE sd.supplier_id = $1
        AND (sd.uploaded_by = 'staff' OR sd.uploaded_by_type = 'staff')
      ORDER BY sd.uploaded_at DESC
    `, [supplier.id]);

    res.json(rows);
  } catch (err) {
    console.error('[SP GET /documents]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/supplier-portal/:token/uploads
// Documents uploaded BY the supplier (to share with us)
// ══════════════════════════════════════════════════════════════
router.get('/:token/uploads', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });

    const { rows } = await pool.query(`
      SELECT
        sd.id, sd.file_name, sd.file_url, sd.folder, sd.note, sd.uploaded_at,
        (SELECT json_agg(n ORDER BY n.created_at ASC)
         FROM supplier_document_notes n WHERE n.doc_id = sd.id) AS notes
      FROM supplier_documents sd
      WHERE sd.supplier_id = $1
        AND (sd.uploaded_by = 'supplier' OR sd.uploaded_by_type = 'supplier')
      ORDER BY sd.uploaded_at DESC
    `, [supplier.id]);

    res.json(rows);
  } catch (err) {
    console.error('[SP GET /uploads]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/supplier-portal/:token/upload
// Supplier uploads a document (stored in PostgreSQL)
// ══════════════════════════════════════════════════════════════
router.post('/:token/upload', upload.single('file'), async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });
    if (!req.file)  return res.status(400).json({ error: 'No file provided' });

    const { note } = req.body;
    const fields = prepareFileFields(req.file);

    // Store file binary in DB — no Supabase, no egress
    const { rows: [doc] } = await pool.query(`
      INSERT INTO supplier_documents
        (supplier_id, folder, file_name, file_url, uploaded_by, uploaded_by_type, note, file_data, file_size)
      VALUES ($1, 'other', $2, $3, 'supplier', 'supplier', $4, $5, $6)
      RETURNING id, supplier_id, folder, file_name, file_type, note, file_size, uploaded_at
    `, [supplier.id, req.file.originalname, fields.file_url, note || null, fields.file_data, fields.file_size]);

    res.status(201).json(doc);
  } catch (err) {
    console.error('[SP POST /upload]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/supplier-portal/:token/uploads/:docId/download
// Serve a supplier-uploaded file from PostgreSQL
// ══════════════════════════════════════════════════════════════
router.get('/:token/uploads/:docId/download', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });

    const { rows: [doc] } = await pool.query(
      'SELECT file_name, file_type, file_data, file_url FROM supplier_documents WHERE id = $1 AND supplier_id = $2',
      [req.params.docId, supplier.id]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Prefer local binary; fall back to redirect for old Supabase URLs
    if (doc.file_data) {
      return serveFile(res, doc.file_data, doc.file_type, doc.file_name);
    }
    if (doc.file_url) {
      return res.redirect(302, doc.file_url);
    }
    return res.status(404).json({ error: 'No file data available' });
  } catch (err) {
    console.error('[SP GET /uploads/:docId/download]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/supplier-portal/:token/documents/:docId/download
// Serve a staff-shared document from PostgreSQL
// ══════════════════════════════════════════════════════════════
router.get('/:token/documents/:docId/download', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });

    const { rows: [doc] } = await pool.query(
      `SELECT file_name, file_type, file_data, file_url
       FROM supplier_documents
       WHERE id = $1 AND supplier_id = $2
         AND (uploaded_by = 'staff' OR uploaded_by_type = 'staff')`,
      [req.params.docId, supplier.id]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (doc.file_data) {
      return serveFile(res, doc.file_data, doc.file_type, doc.file_name);
    }
    if (doc.file_url) {
      return res.redirect(302, doc.file_url);
    }
    return res.status(404).json({ error: 'No file data available' });
  } catch (err) {
    console.error('[SP GET /documents/:docId/download]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/supplier-portal/:token/documents/:docId/notes
// Add a thread note to a document
// ══════════════════════════════════════════════════════════════
router.post('/:token/documents/:docId/notes', async (req, res) => {
  try {
    const supplier = await resolveSupplier(req.params.token);
    if (!supplier) return res.status(404).json({ error: 'Portal not found' });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Note content required' });

    // Verify the doc belongs to this supplier
    const { rows: [doc] } = await pool.query(
      'SELECT id FROM supplier_documents WHERE id = $1 AND supplier_id = $2',
      [req.params.docId, supplier.id]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const { rows: [note] } = await pool.query(`
      INSERT INTO supplier_document_notes (doc_id, author_type, content)
      VALUES ($1, 'supplier', $2) RETURNING *
    `, [req.params.docId, content.trim()]);

    res.status(201).json(note);
  } catch (err) {
    console.error('[SP POST /documents/:docId/notes]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
