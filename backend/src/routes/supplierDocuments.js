const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
// Supplier push notifications not yet implemented - no-op for now
const sendSupplierNotification = (id, type, data) =>
  console.log(`[SupplierNotif] id=${id} type=${type}`, data);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ 
  storage, 
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

router.use(authenticate);

router.get('/', async (req, res) => {
  // If user role is staff, proceed. If supplier, ensure req.user.supplier_id matches req.params.id (handled in supplierPortal.js but just in case we hit this via internal app)
  try {
    let query = 'SELECT * FROM supplier_documents WHERE supplier_id = $1';
    let params = [req.params.id];
    if (req.query.folder) {
      query += ' AND folder = $2';
      params.push(req.query.folder);
    }
    query += ' ORDER BY uploaded_at DESC';
    const { rows } = await pool.query(query, params);
    
    // Quick intercept to allow full URLs (assumes local serving /uploads)
    res.json(rows.map(r => ({ ...r, file_url: `${req.protocol}://${req.get('host')}/uploads/${path.basename(r.file_url)}` })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authorize('admin', 'manager'), upload.single('file'), async (req, res) => {
  const { folder, transaction_id, order_id } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!folder) return res.status(400).json({ error: 'Folder is required' });

  try {
    const { rows } = await pool.query(`
      INSERT INTO supplier_documents (supplier_id, transaction_id, order_id, folder, file_name, file_url, uploaded_by, uploaded_by_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'staff') RETURNING *
    `, [req.params.id, transaction_id || null, order_id || null, folder, req.file.originalname, req.file.path, 'staff']);
    
    sendSupplierNotification(req.params.id, 'document_uploaded', {});
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:docId', authorize('admin', 'manager'), async (req, res) => {
  try {
    await pool.query('DELETE FROM supplier_documents WHERE id = $1 AND uploaded_by_type = $2', [req.params.docId, 'staff']);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
