const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete, isAdmin } = require('../middleware/rbac');
const { logActivity } = require('../services/activityLog');

router.use(authenticate);

// ══════════════════════════════════════════════════════
// INVOICES (Tuition Bills)
// ══════════════════════════════════════════════════════

router.get('/invoices', canView('finance'), async (req, res) => {
  const { student_id, status } = req.query;
  try {
    const params = [], conditions = [];
    if (student_id) { params.push(student_id); conditions.push(`i.student_id = $${params.length}`); }
    if (status)     { params.push(status);     conditions.push(`i.status = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT i.*, s.full_name AS student_name,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS amount_paid
      FROM invoices i
      LEFT JOIN students s ON s.id = i.student_id
      ${where}
      ORDER BY i.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/invoices/:id', canView('finance'), async (req, res) => {
  try {
    const { rows: [invoice] } = await pool.query(`
      SELECT i.*, s.full_name AS student_name, s.email AS student_email
      FROM invoices i LEFT JOIN students s ON s.id = i.student_id
      WHERE i.id = $1
    `, [req.params.id]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const [itemsRes, paymentsRes] = await Promise.all([
      pool.query('SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY id', [req.params.id]),
      pool.query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC', [req.params.id]),
    ]);
    res.json({ ...invoice, line_items: itemsRes.rows, payments: paymentsRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/invoices', canCreate('finance'), async (req, res) => {
  const { student_id, due_date, notes, line_items, discount } = req.body;
  if (!student_id || !line_items?.length)
    return res.status(400).json({ error: 'student_id and line_items are required' });

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows: [{ maxnum }] } = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) AS maxnum FROM invoices WHERE invoice_number LIKE $1`,
      [`INV-${new Date().getFullYear()}-%`]
    );
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(maxnum + 1).padStart(3, '0')}`;
    let subtotal = 0;
    for (const item of line_items) subtotal += parseFloat(item.quantity || 1) * parseFloat(item.unit_price || 0);
    const total = subtotal - parseFloat(discount || 0);

    const { rows: [invoice] } = await db.query(`
      INSERT INTO invoices (student_id, invoice_number, due_date, notes, subtotal, discount, total, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [student_id, invoiceNumber, due_date || null, notes || null, subtotal, discount || 0, total, req.user.id]);

    for (const item of line_items) {
      const lTotal = parseFloat(item.quantity || 1) * parseFloat(item.unit_price || 0);
      await db.query(`INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)`,
        [invoice.id, item.description, item.quantity || 1, item.unit_price || 0, lTotal]);
    }
    await db.query('COMMIT');
    await logActivity({ studentId: student_id, userId: req.user.id, actionType: 'invoice_created', description: `Invoice ${invoiceNumber} created` });
    res.status(201).json(invoice);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

router.put('/invoices/:id', canEdit('finance'), async (req, res) => {
  const { status, notes, due_date, discount, line_items } = req.body;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows: [inv] } = await db.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!inv) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    if (status === 'paid' && inv.status !== 'paid') {
      await db.query('UPDATE invoices SET paid_date = CURRENT_DATE WHERE id = $1', [req.params.id]);
    }

    const { rows: [invoice] } = await db.query(`
      UPDATE invoices SET
        status   = COALESCE($1, status),
        notes    = COALESCE($2, notes),
        due_date = COALESCE($3, due_date),
        discount = COALESCE($4, discount)
      WHERE id = $5 RETURNING *
    `, [status, notes, due_date, discount, req.params.id]);

    if (line_items) {
      await db.query('DELETE FROM invoice_line_items WHERE invoice_id = $1', [req.params.id]);
      let subtotal = 0;
      for (const item of line_items) {
        const lTotal = parseFloat(item.quantity || 1) * parseFloat(item.unit_price || 0);
        subtotal += lTotal;
        await db.query('INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)',
          [invoice.id, item.description, item.quantity || 1, item.unit_price || 0, lTotal]);
      }
      await db.query('UPDATE invoices SET subtotal=$1, total=$2 WHERE id=$3', [subtotal, subtotal - parseFloat(invoice.discount || 0), invoice.id]);
    }
    await db.query('COMMIT');
    res.json(invoice);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

router.delete('/invoices/:id', canDelete('finance'), async (req, res) => {
  try {
    await pool.query('DELETE FROM invoice_line_items WHERE invoice_id = $1', [req.params.id]);
    await pool.query('DELETE FROM payments WHERE invoice_id = $1', [req.params.id]);
    await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ message: 'Invoice deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════
// PAYMENTS (Tuition Received)
// ══════════════════════════════════════════════════════

router.get('/payments', canView('finance'), async (req, res) => {
  const { student_id, invoice_id } = req.query;
  try {
    const params = [], conditions = [];
    if (student_id) { params.push(student_id); conditions.push(`p.student_id = $${params.length}`); }
    if (invoice_id) { params.push(invoice_id); conditions.push(`p.invoice_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT p.*, i.invoice_number, s.full_name AS student_name, u.name AS recorded_by_name
      FROM payments p
      LEFT JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN students s ON s.id = p.student_id
      LEFT JOIN users u ON u.id = p.created_by
      ${where}
      ORDER BY p.payment_date DESC
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', canCreate('finance'), async (req, res) => {
  const { student_id, invoice_id, amount, payment_date, method, reference, notes } = req.body;
  if (!student_id || !amount) return res.status(400).json({ error: 'student_id and amount are required' });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows: [payment] } = await db.query(`
      INSERT INTO payments (student_id, invoice_id, amount, payment_date, method, reference, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [student_id, invoice_id || null, amount, payment_date || null, method || 'cash', reference || null, notes || null, req.user.id]);

    // Auto-mark invoice as paid if fully covered
    if (invoice_id) {
      const { rows: [inv] } = await db.query('SELECT total FROM invoices WHERE id = $1', [invoice_id]);
      const { rows: [paid] } = await db.query('SELECT COALESCE(SUM(amount),0) AS total_paid FROM payments WHERE invoice_id = $1', [invoice_id]);
      if (inv && parseFloat(paid.total_paid) >= parseFloat(inv.total)) {
        await db.query(`UPDATE invoices SET status='paid', paid_date=CURRENT_DATE WHERE id=$1`, [invoice_id]);
      }
    }
    await db.query('COMMIT');
    await logActivity({ studentId: student_id, userId: req.user.id, actionType: 'payment_recorded', description: `Payment of ${amount} DZD recorded` });
    res.status(201).json(payment);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

router.delete('/payments/:id', canDelete('finance'), async (req, res) => {
  try {
    await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Payment deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════
// SUBJECT PAYMENTS (Monthly Fee Tracking)
// ══════════════════════════════════════════════════════

router.get('/subject-payments', canView('finance'), async (req, res) => {
  const { student_id, subject_id, status } = req.query;
  try {
    const params = [], conditions = [];
    if (student_id) { params.push(student_id); conditions.push(`sp.student_id = $${params.length}`); }
    if (subject_id) { params.push(subject_id); conditions.push(`sp.subject_id = $${params.length}`); }
    if (status)     { params.push(status);     conditions.push(`sp.status = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT sp.*, s.full_name AS student_name, sub.name AS subject_name, sub.color_code
      FROM subject_payments sp
      LEFT JOIN students s ON s.id = sp.student_id
      LEFT JOIN subjects sub ON sub.id = sp.subject_id
      ${where}
      ORDER BY sp.due_date DESC
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/subject-payments', canCreate('finance'), async (req, res) => {
  const { student_id, subject_id, amount, due_date, notes } = req.body;
  if (!student_id || !subject_id || !amount || !due_date)
    return res.status(400).json({ error: 'student_id, subject_id, amount, due_date are required' });
  const { rows: [sp] } = await pool.query(`
    INSERT INTO subject_payments (student_id, subject_id, amount, due_date, notes)
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [student_id, subject_id, amount, due_date, notes || null]);
  res.status(201).json(sp);
});

router.put('/subject-payments/:id', canEdit('finance'), async (req, res) => {
  const { status, paid_date, notes, amount } = req.body;
  const { rows: [sp] } = await pool.query(`
    UPDATE subject_payments SET
      status    = COALESCE($1, status),
      paid_date = COALESCE($2, paid_date),
      notes     = COALESCE($3, notes),
      amount    = COALESCE($4, amount)
    WHERE id = $5 RETURNING *
  `, [status, paid_date || null, notes, amount, req.params.id]);
  if (!sp) return res.status(404).json({ error: 'Not found' });
  res.json(sp);
});

router.delete('/subject-payments/:id', canDelete('finance'), async (req, res) => {
  await pool.query('DELETE FROM subject_payments WHERE id = $1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════
// EXPENSES (School Operating Costs)
// ══════════════════════════════════════════════════════

router.get('/expenses', canView('finance'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*, u.name AS created_by_name
      FROM expenses e LEFT JOIN users u ON u.id = e.created_by
      ORDER BY e.expense_date DESC, e.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/expenses', canCreate('finance'), async (req, res) => {
  const { title, category, amount, expense_date, is_recurring, recurrence, notes } = req.body;
  if (!title || !amount) return res.status(400).json({ error: 'title and amount are required' });
  const { rows: [e] } = await pool.query(`
    INSERT INTO expenses (title, category, amount, expense_date, is_recurring, recurrence, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [title, category || null, amount, expense_date || null, is_recurring || false, recurrence || null, notes || null, req.user.id]);
  res.status(201).json(e);
});

router.put('/expenses/:id', canEdit('finance'), async (req, res) => {
  const { title, category, amount, expense_date, is_recurring, recurrence, notes } = req.body;
  const { rows: [e] } = await pool.query(`
    UPDATE expenses SET
      title        = COALESCE($1, title),
      category     = COALESCE($2, category),
      amount       = COALESCE($3, amount),
      expense_date = COALESCE($4, expense_date),
      is_recurring = COALESCE($5, is_recurring),
      recurrence   = COALESCE($6, recurrence),
      notes        = COALESCE($7, notes)
    WHERE id = $8 RETURNING *
  `, [title, category, amount, expense_date, is_recurring, recurrence, notes, req.params.id]);
  if (!e) return res.status(404).json({ error: 'Not found' });
  res.json(e);
});

router.delete('/expenses/:id', canDelete('finance'), async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  res.json({ message: 'Expense deleted' });
});

// ══════════════════════════════════════════════════════
// TEACHER PAYMENTS (Salary)
// ══════════════════════════════════════════════════════

router.get('/teacher-payments', canView('finance'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT tp.*, t.name AS teacher_name
      FROM teacher_payments tp
      LEFT JOIN teachers t ON t.id = tp.teacher_id
      ORDER BY tp.payment_date DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════
// P&L SUMMARY
// ══════════════════════════════════════════════════════

router.get('/pl', canView('finance'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const y = parseInt(year || new Date().getFullYear());
    const m = month ? parseInt(month) : null;

    const dateFilter = m
      ? `AND EXTRACT(YEAR FROM payment_date) = ${y} AND EXTRACT(MONTH FROM payment_date) = ${m}`
      : `AND EXTRACT(YEAR FROM payment_date) = ${y}`;

    const expDateFilter = m
      ? `AND EXTRACT(YEAR FROM expense_date) = ${y} AND EXTRACT(MONTH FROM expense_date) = ${m}`
      : `AND EXTRACT(YEAR FROM expense_date) = ${y}`;

    const [revenueRes, expensesRes, teacherPayRes, subPayRes] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE 1=1 ${dateFilter}`),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE 1=1 ${expDateFilter}`),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM teacher_payments WHERE 1=1 ${dateFilter}`),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM subject_payments WHERE status='paid' AND 1=1 ${m ? `AND EXTRACT(YEAR FROM paid_date)=${y} AND EXTRACT(MONTH FROM paid_date)=${m}` : `AND EXTRACT(YEAR FROM paid_date)=${y}`}`),
    ]);

    const revenue    = parseFloat(revenueRes.rows[0].total) + parseFloat(subPayRes.rows[0].total);
    const expenses   = parseFloat(expensesRes.rows[0].total);
    const teacherPay = parseFloat(teacherPayRes.rows[0].total);
    const totalCosts = expenses + teacherPay;
    const netProfit  = revenue - totalCosts;

    res.json({ revenue, expenses, teacher_payments: teacherPay, total_costs: totalCosts, net_profit: netProfit, year: y, month: m });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
