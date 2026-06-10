const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete, isAdmin } = require('../middleware/rbac');
const { logActivity } = require('../services/activityLog');
const { createPortalNotification } = require('../services/portalNotifications');
const PDFDocument = require('pdfkit');

router.use(authenticate);

// ── QUOTATIONS ─────────────────────────────────────────────────

// GET /api/finance/quotes
router.get('/quotes', canView('finance'), async (req, res) => {
  const { client_id, status } = req.query;
  try {
    const params = [];
    const conditions = [];
    if (client_id) { params.push(client_id); conditions.push(`q.client_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`q.status = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT q.*, c.company_name AS client_name,
        COALESCE(SUM(li.total), 0) AS grand_total
      FROM quotations q
      LEFT JOIN clients c ON c.id = q.client_id
      LEFT JOIN quotation_line_items li ON li.quotation_id = q.id
      ${where}
      GROUP BY q.id, c.company_name
      ORDER BY q.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/quotes/:id
router.get('/quotes/:id', canView('finance'), async (req, res) => {
  try {
    const { rows: [quote] } = await pool.query(`
      SELECT q.*, c.company_name AS client_name, c.contact_name, c.contact_email
      FROM quotations q LEFT JOIN clients c ON c.id = q.client_id
      WHERE q.id = $1
    `, [req.params.id]);
    if (!quote) return res.status(404).json({ error: 'Quotation not found' });

    const { rows: lineItems } = await pool.query(
      'SELECT * FROM quotation_line_items WHERE quotation_id = $1 ORDER BY id',
      [req.params.id]
    );
    res.json({ ...quote, line_items: lineItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/quotes
router.post('/quotes', canCreate('finance'), async (req, res) => {
  const { client_id, notes, line_items } = req.body;
  if (!client_id || !line_items?.length)
    return res.status(400).json({ error: 'client_id and line_items are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Generate quote number
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM quotations');
    const quoteNumber = `QT-${new Date().getFullYear()}-${String(parseInt(count) + 1).padStart(3, '0')}`;

    const { rows: [quote] } = await client.query(`
      INSERT INTO quotations (client_id, quote_number, notes)
      VALUES ($1, $2, $3) RETURNING *
    `, [client_id, quoteNumber, notes]);

    for (const item of line_items) {
      await client.query(`
        INSERT INTO quotation_line_items (quotation_id, description, quantity, unit_price)
        VALUES ($1, $2, $3, $4)
      `, [quote.id, item.description, item.quantity, item.unit_price]);
    }

    await client.query('COMMIT');
    res.status(201).json(quote);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/finance/quotes/:id
router.put('/quotes/:id', canEdit('finance'), async (req, res) => {
  const { status, notes, line_items, portal_visible } = req.body;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    // Fetch current state to detect portal_visible transition
    const { rows: [currentQuote] } = await db.query(
      'SELECT portal_visible, client_id FROM quotations WHERE id = $1', [req.params.id]
    );
    if (!currentQuote) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    // Auto-enable portal visibility when status becomes 'sent' or 'accepted'
    const effectivePortalVisible = ['sent', 'accepted'].includes(status)
      ? true
      : (portal_visible !== undefined ? portal_visible : null);
    const { rows: [quote] } = await db.query(`
      UPDATE quotations
      SET status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          portal_visible = COALESCE($4, portal_visible),
          updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [status, notes, req.params.id, effectivePortalVisible]);

    if (!quote) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    if (line_items) {
      await db.query('DELETE FROM quotation_line_items WHERE quotation_id = $1', [req.params.id]);
      for (const item of line_items) {
        await db.query(`
          INSERT INTO quotation_line_items (quotation_id, description, quantity, unit_price)
          VALUES ($1, $2, $3, $4)
        `, [quote.id, item.description, item.quantity, item.unit_price]);
      }
    }

    // Auto-generate invoice and add to pipeline when quote is accepted
    if (status === 'accepted') {
      const { rows: [existing] } = await db.query(
        'SELECT id FROM invoices WHERE quotation_id = $1 LIMIT 1', [quote.id]
      );
      if (!existing) {
        const { rows: quoteItems } = await db.query(
          'SELECT * FROM quotation_line_items WHERE quotation_id = $1', [quote.id]
        );
        const { rows: [{ maxnum: qMaxNum }] } = await db.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) AS maxnum FROM invoices WHERE invoice_number LIKE $1`,
          [`INV-${new Date().getFullYear()}-%`]
        );
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(qMaxNum + 1).padStart(3, '0')}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const { rows: [invoice] } = await db.query(`
          INSERT INTO invoices (client_id, quotation_id, invoice_number, due_date, notes)
          VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [quote.client_id, quote.id, invoiceNumber, dueDateStr, quote.notes]);

        for (const item of quoteItems) {
          await db.query(`
            INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price)
            VALUES ($1, $2, $3, $4)
          `, [invoice.id, item.description, item.quantity, item.unit_price]);
        }

        await logActivity({
          clientId: quote.client_id,
          userId: req.user.id,
          actionType: 'invoice_created',
          description: `Invoice ${invoiceNumber} auto-generated from accepted quote ${quote.quote_number}`,
        });

        // "Automatically add to Pipeline" -> Create a Task representing the new project delivery
        await db.query(`
          INSERT INTO tasks (client_id, title, description, status, progress_pct)
          VALUES ($1, $2, $3, $4, 0)
        `, [
          quote.client_id, 
          `Project Delivery - Quote ${quote.quote_number}`, 
          `Auto-generated from accepted quote ${quote.quote_number}.\n${quote.notes || ''}`, 
          'not_started'
        ]);
        
        await logActivity({
          clientId: quote.client_id,
          userId: req.user.id,
          actionType: 'task_created',
          description: `Added to project pipeline from accepted quote ${quote.quote_number}`,
        });
      }
    }

    await db.query('COMMIT');

    // Portal notification: client receives quote
    if (effectivePortalVisible === true && !currentQuote?.portal_visible) {
      await createPortalNotification({
        clientId: quote.client_id,
        type: 'quote_received',
        title: '📋 Nouveau devis reçu',
        message: `Votre devis ${quote.quote_number} est disponible dans votre espace client.`,
      });
    }

    res.json(quote);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// DELETE /api/finance/quotes/:id
router.delete('/quotes/:id', canDelete('finance'), async (req, res) => {
  try {
    // Snapshot the quote before deleting so it stays in the activity log
    const { rows: [quote] } = await pool.query(`
      SELECT q.*, c.company_name,
        COALESCE(SUM(li.quantity * li.unit_price), 0) AS grand_total,
        json_agg(json_build_object('description', li.description, 'qty', li.quantity, 'price', li.unit_price) ORDER BY li.id) AS items
      FROM quotations q
      LEFT JOIN clients c ON c.id = q.client_id
      LEFT JOIN quotation_line_items li ON li.quotation_id = q.id
      WHERE q.id = $1
      GROUP BY q.id, c.company_name
    `, [req.params.id]);

    if (quote) {
      const itemsSummary = (quote.items || [])
        .filter(i => i.description)
        .map(i => `${i.description} x${i.qty}`)
        .join(', ');
      await logActivity({
        clientId: quote.client_id,
        userId: req.user?.id || null,
        actionType: 'quote_deleted',
        description: `[SUPPRIMÉ] Devis ${quote.quote_number} — ${quote.company_name} — Statut: ${quote.status} — Total: ${parseFloat(quote.grand_total).toFixed(2)} DZD${itemsSummary ? ` — Articles: ${itemsSummary}` : ''}`,
      });
    }

    await pool.query('DELETE FROM quotations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Quotation deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/finance/quotes/:id/pdf
router.get('/quotes/:id/pdf', canView('finance'), async (req, res) => {
  try {
    const { rows: [quote] } = await pool.query(`
      SELECT q.*, c.company_name, c.contact_name, c.contact_email
      FROM quotations q LEFT JOIN clients c ON c.id = q.client_id
      WHERE q.id = $1
    `, [req.params.id]);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    const { rows: items } = await pool.query(
      'SELECT * FROM quotation_line_items WHERE quotation_id = $1',
      [req.params.id]
    );

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quote_number}.pdf"`);
    doc.pipe(res);
    generatePDF(doc, 'QUOTATION', quote, items);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── INVOICES ───────────────────────────────────────────────────

// GET /api/finance/invoices
router.get('/invoices', canView('finance'), async (req, res) => {
  const { client_id, status } = req.query;
  try {
    const params = [];
    const conditions = [];
    if (client_id) { params.push(client_id); conditions.push(`i.client_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Managers can only read totals, not full details
    const { rows } = await pool.query(`
      SELECT i.*, c.company_name AS client_name,
        (COALESCE(SUM(li.total), 0) - (COALESCE(SUM(li.total), 0) * COALESCE(i.discount_pct, 0) / 100)) AS grand_total,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS amount_paid
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
      ${where}
      GROUP BY i.id, c.company_name
      ORDER BY i.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/invoices/:id
router.get('/invoices/:id', canView('finance'), async (req, res) => {
  try {
    const { rows: [invoice] } = await pool.query(`
      SELECT i.*, c.company_name, c.contact_name, c.contact_email,
        COALESCE(c.wallet_balance, 0) AS wallet_balance,
        (SELECT COALESCE(SUM(total), 0) FROM invoice_line_items WHERE invoice_id = i.id) AS subtotal,
        ((SELECT COALESCE(SUM(total), 0) FROM invoice_line_items WHERE invoice_id = i.id) - ((SELECT COALESCE(SUM(total), 0) FROM invoice_line_items WHERE invoice_id = i.id) * COALESCE(i.discount_pct, 0) / 100)) AS grand_total
      FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.id = $1
    `, [req.params.id]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const { rows: lineItems } = await pool.query(
      'SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY id',
      [req.params.id]
    );
    const { rows: payments } = await pool.query(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC',
      [req.params.id]
    );

    // Fetch total ads spent in DZD for this client
    // ads_spend_logs uses `amount` in USD; we convert using the latest rate
    const { rows: [rateRow] } = await pool.query(
      'SELECT rate FROM dzd_usd_rates ORDER BY effective_date DESC, created_at DESC LIMIT 1'
    );
    const currentRate = rateRow ? parseFloat(rateRow.rate) : 1;

    const { rows: [adsRow] } = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS total_usd FROM ads_spend_logs WHERE client_id = $1',
      [invoice.client_id]
    );
    const total_ads_spent = parseFloat(adsRow.total_usd) * currentRate;

    res.json({ ...invoice, line_items: lineItems, payments, total_ads_spent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/invoices
router.post('/invoices', canCreate('finance'), async (req, res) => {
  const { client_id, due_date, notes, line_items, discount_pct } = req.body;
  if (!client_id || !due_date || !line_items?.length)
    return res.status(400).json({ error: 'client_id, due_date, and line_items are required' });

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    // Use MAX to avoid duplicate number bugs when rows are deleted
    const { rows: [{ maxnum }] } = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) AS maxnum FROM invoices WHERE invoice_number LIKE $1`,
      [`INV-${new Date().getFullYear()}-%`]
    );
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(maxnum + 1).padStart(3, '0')}`;

    const { rows: [invoice] } = await db.query(`
      INSERT INTO invoices (client_id, invoice_number, due_date, notes, discount_pct)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [client_id, invoiceNumber, due_date, notes, discount_pct || 0]);

    for (const item of line_items) {
      await db.query(`
        INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price)
        VALUES ($1, $2, $3, $4)
      `, [invoice.id, item.description, item.quantity, item.unit_price]);
    }

    await db.query('COMMIT');

    await logActivity({
      clientId: client_id,
      userId: req.user.id,
      actionType: 'invoice_created',
      description: `Invoice ${invoiceNumber} created`,
    });

    res.status(201).json(invoice);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});


// POST /api/finance/invoices/from-quote/:quotationId
router.post('/invoices/from-quote/:quotationId', canCreate('finance'), async (req, res) => {
  const { due_date, notes } = req.body;
  if (!due_date) return res.status(400).json({ error: 'due_date is required' });

  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    const { rows: [quote] } = await db.query(
      'SELECT * FROM quotations WHERE id = $1', [req.params.quotationId]
    );
    if (!quote) return res.status(404).json({ error: 'Quotation not found' });

    const { rows: quoteItems } = await db.query(
      'SELECT * FROM quotation_line_items WHERE quotation_id = $1', [quote.id]
    );

    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM invoices');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(parseInt(count) + 1).padStart(3, '0')}`;

    const { rows: [invoice] } = await db.query(`
      INSERT INTO invoices (client_id, quotation_id, invoice_number, due_date, notes)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [quote.client_id, quote.id, invoiceNumber, due_date, notes || quote.notes]);

    for (const item of quoteItems) {
      await db.query(`
        INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price)
        VALUES ($1, $2, $3, $4)
      `, [invoice.id, item.description, item.quantity, item.unit_price]);
    }

    // Mark quotation as approved
    await db.query(`UPDATE quotations SET status = 'approved', updated_at = NOW() WHERE id = $1`, [quote.id]);

    await db.query('COMMIT');

    await logActivity({
      clientId: quote.client_id,
      userId: req.user.id,
      actionType: 'invoice_created',
      description: `Invoice ${invoiceNumber} created from quote ${quote.quote_number}`,
    });

    res.status(201).json(invoice);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// PUT /api/finance/invoices/:id
router.put('/invoices/:id', canEdit('finance'), async (req, res) => {
  const { status, notes, due_date, line_items, discount_pct, portal_visible } = req.body;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    // Get the current invoice state before updating
    const { rows: [currentInv] } = await db.query(
      'SELECT * FROM invoices WHERE id = $1', [req.params.id]
    );
    if (!currentInv) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    // Auto-enable portal visibility when status becomes 'sent', 'paid', or 'overdue'
    const effectivePortalVisible = ['sent', 'paid', 'overdue'].includes(status)
      ? true
      : (portal_visible !== undefined ? portal_visible : null);

    const { rows: [invoice] } = await db.query(`
      UPDATE invoices
      SET status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          due_date = COALESCE($3, due_date),
          discount_pct = COALESCE($4, discount_pct),
          portal_visible = COALESCE($6, portal_visible)
      WHERE id = $5 RETURNING *
    `, [status, notes, due_date, discount_pct, req.params.id, effectivePortalVisible]);

    if (!invoice) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    if (status === 'sent') {
      await logActivity({
        clientId: invoice.client_id,
        userId: req.user.id,
        actionType: 'invoice_sent',
        description: `Invoice ${invoice.invoice_number} sent to client`,
      });
    }

    // When manually marked overdue (and wasn't already overdue), deduct from client wallet
    if (status === 'overdue' && currentInv.status !== 'overdue') {
      const { rows: [totals] } = await db.query(
        'SELECT COALESCE(SUM(total), 0) AS inv_total FROM invoice_line_items WHERE invoice_id = $1',
        [req.params.id]
      );
      const { rows: [paid] } = await db.query(
        'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = $1',
        [req.params.id]
      );
      const outstanding = (parseFloat(totals.inv_total) - (parseFloat(totals.inv_total) * COALESCE(currentInv.discount_pct, 0) / 100)) - parseFloat(paid.total_paid);
      if (outstanding > 0) {
        await db.query(`
          INSERT INTO transactions (type, amount, currency, amount_dzd, client_id, reference_id, description)
          VALUES ('overdue_deduction', $1, 'DZD', $1, $2, $3, $4)
        `, [outstanding, invoice.client_id, invoice.id, `Overdue deduction for invoice ${invoice.invoice_number}`]);
        await logActivity({
          clientId: invoice.client_id,
          userId: req.user.id,
          actionType: 'wallet_deducted',
          description: `Wallet deducted ${outstanding.toFixed(2)} DZD — invoice ${invoice.invoice_number} marked overdue`,
        });
      }
    }

    if (line_items) {
      await db.query('DELETE FROM invoice_line_items WHERE invoice_id = $1', [req.params.id]);
      for (const item of line_items) {
        await db.query(`
          INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price)
          VALUES ($1, $2, $3, $4)
        `, [invoice.id, item.description, item.quantity, item.unit_price]);
      }
    }

    await db.query('COMMIT');

    // Portal notification: client receives invoice
    if (effectivePortalVisible === true && !currentInv.portal_visible) {
      await createPortalNotification({
        clientId: invoice.client_id,
        type: 'invoice_received',
        title: '🧾 Nouvelle facture reçue',
        message: `Votre facture ${invoice.invoice_number} est disponible dans votre espace client.`,
      });
    }

    res.json(invoice);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// DELETE /api/finance/invoices/:id
router.delete('/invoices/:id', canDelete('finance'), async (req, res) => {
  try {
    // Snapshot the invoice before deleting so it stays in the activity log
    const { rows: [invoice] } = await pool.query(`
      SELECT i.*, c.company_name,
        COALESCE(
          SUM(li.quantity * li.unit_price) - SUM(li.quantity * li.unit_price) * COALESCE(i.discount_pct, 0) / 100
        , 0) AS grand_total,
        json_agg(json_build_object('description', li.description, 'qty', li.quantity, 'price', li.unit_price) ORDER BY li.id) AS items
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
      WHERE i.id = $1
      GROUP BY i.id, c.company_name
    `, [req.params.id]);

    if (invoice) {
      const itemsSummary = (invoice.items || [])
        .filter(i => i.description)
        .map(i => `${i.description} x${i.qty}`)
        .join(', ');
      await logActivity({
        clientId: invoice.client_id,
        userId: req.user?.id || null,
        actionType: 'invoice_deleted',
        description: `[SUPPRIMÉ] Facture ${invoice.invoice_number} — ${invoice.company_name} — Statut: ${invoice.status} — Total: ${parseFloat(invoice.grand_total).toFixed(2)} DZD${itemsSummary ? ` — Articles: ${itemsSummary}` : ''}`,
      });
    }

    await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/finance/invoices/:id/pdf
router.get('/invoices/:id/pdf', canView('finance'), async (req, res) => {
  try {
    const { rows: [invoice] } = await pool.query(`
      SELECT i.*, c.company_name, c.contact_name, c.contact_email
      FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.id = $1
    `, [req.params.id]);
    if (!invoice) return res.status(404).json({ error: 'Not found' });

    const { rows: items } = await pool.query(
      'SELECT * FROM invoice_line_items WHERE invoice_id = $1',
      [req.params.id]
    );

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    doc.pipe(res);
    generatePDF(doc, 'INVOICE', invoice, items);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── BON DE VERSEMENT (Client Wallet Deposits) ─────────────────

// GET /api/finance/versements?client_id=
router.get('/versements', canView('finance'), async (req, res) => {
  const { client_id } = req.query;
  try {
    const params = [];
    const conditions = [];
    if (client_id) { params.push(client_id); conditions.push(`v.client_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT v.*, c.company_name AS client_name, u.name AS logged_by_name
      FROM client_versements v
      LEFT JOIN clients c ON c.id = v.client_id
      LEFT JOIN users u ON u.id = v.logged_by
      ${where}
      ORDER BY v.versement_date DESC, v.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/versements  — Log a new Bon de Versement (credits the wallet)
router.post('/versements', canCreate('finance'), async (req, res) => {
  const { client_id, amount_dzd, versement_date, notes } = req.body;
  if (!client_id || !amount_dzd)
    return res.status(400).json({ error: 'client_id and amount_dzd are required' });

  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    // Generate versement number
    const { rows: [{ maxnum }] } = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(versement_number FROM '[0-9]+$') AS INTEGER)), 0) AS maxnum
       FROM client_versements WHERE versement_number LIKE $1`,
      [`BV-${new Date().getFullYear()}-%`]
    );
    const versementNumber = `BV-${new Date().getFullYear()}-${String(maxnum + 1).padStart(3, '0')}`;

    const { rows: [versement] } = await db.query(`
      INSERT INTO client_versements (client_id, logged_by, versement_number, amount_dzd, versement_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [client_id, req.user.id, versementNumber, amount_dzd,
        versement_date || new Date().toISOString().split('T')[0], notes || null]);

    // Credit the wallet_balance column
    await db.query(`
      UPDATE clients
      SET wallet_balance = COALESCE(wallet_balance, 0) + $1
      WHERE id = $2
    `, [amount_dzd, client_id]);

    // Record in central ledger
    await db.query(`
      INSERT INTO transactions (type, amount, currency, amount_dzd, client_id, user_id, reference_id, description, transaction_date)
      VALUES ('versement', $1, 'DZD', $1, $2, $3, $4, $5, $6)
    `, [amount_dzd, client_id, req.user.id, versement.id,
        `Bon de Versement ${versementNumber}`,
        versement_date || new Date().toISOString()]);

    await db.query('COMMIT');

    await logActivity({
      clientId: client_id,
      userId: req.user.id,
      actionType: 'versement_logged',
      description: `Bon de Versement ${versementNumber} — ${parseFloat(amount_dzd).toFixed(2)} DZD credited to wallet`,
    });

    // Notify client portal that wallet was credited
    await createPortalNotification({
      clientId: client_id,
      type: 'invoice_received',
      title: '💰 Portefeuille crédité',
      message: `Votre portefeuille a été crédité de ${parseFloat(amount_dzd).toLocaleString('fr-DZ')} DZD (Réf: ${versementNumber}).`,
    });

    res.status(201).json(versement);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// PUT /api/finance/versements/:id  — Edit a Bon de Versement (adjusts wallet balance)
router.put('/versements/:id', canEdit('finance'), async (req, res) => {
  const { amount_dzd, versement_date, notes } = req.body;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows: [v] } = await db.query('SELECT * FROM client_versements WHERE id = $1', [req.params.id]);
    if (!v) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Versement not found' }); }

    const oldAmount = parseFloat(v.amount_dzd);
    const newAmount = amount_dzd ? parseFloat(amount_dzd) : oldAmount;
    const diff = newAmount - oldAmount;

    const { rows: [updated] } = await db.query(`
      UPDATE client_versements
      SET amount_dzd = COALESCE($1, amount_dzd),
          versement_date = COALESCE($2, versement_date),
          notes = COALESCE($3, notes)
      WHERE id = $4 RETURNING *
    `, [amount_dzd || null, versement_date || null, notes !== undefined ? notes : null, req.params.id]);

    // Adjust wallet by the difference
    if (diff !== 0) {
      await db.query(`
        UPDATE clients SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2
      `, [diff, v.client_id]);
    }

    await db.query('COMMIT');

    await logActivity({
      clientId: v.client_id,
      userId: req.user.id,
      actionType: 'versement_edited',
      description: `Bon de Versement ${v.versement_number} edited — amount changed from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)} DZD`,
    });

    res.json(updated);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// DELETE /api/finance/versements/:id  — Remove a versement (reverses wallet credit)
router.delete('/versements/:id', canDelete('finance'), async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows: [v] } = await db.query('SELECT * FROM client_versements WHERE id = $1', [req.params.id]);
    if (!v) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Versement not found' }); }

    await db.query('DELETE FROM client_versements WHERE id = $1', [req.params.id]);
    await db.query(`
      UPDATE clients SET wallet_balance = COALESCE(wallet_balance, 0) - $1 WHERE id = $2
    `, [v.amount_dzd, v.client_id]);

    await db.query('COMMIT');
    res.json({ message: 'Versement deleted, wallet reversed' });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// ── PAYMENTS (Invoice settlements — DEDUCTS from wallet) ─────────

// GET /api/finance/payments
router.get('/payments', canView('finance'), async (req, res) => {
  const { invoice_id, client_id } = req.query;
  try {
    const params = [];
    const conditions = [];
    if (invoice_id) { params.push(invoice_id); conditions.push(`p.invoice_id = $${params.length}`); }
    if (client_id) { params.push(client_id); conditions.push(`p.client_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT p.*, i.invoice_number, c.company_name AS client_name
      FROM payments p
      LEFT JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN clients c ON c.id = p.client_id
      ${where}
      ORDER BY p.payment_date DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/payments
// This records that an invoice has been settled/paid.
// It DEDUCTS the amount from the client wallet (not credits!).
// The wallet was already funded via a Bon de Versement.
router.post('/payments', canCreate('finance'), async (req, res) => {
  const { invoice_id, client_id, amount, payment_date, notes } = req.body;
  if (!invoice_id || !client_id || !amount)
    return res.status(400).json({ error: 'invoice_id, client_id, and amount are required' });

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows: [payment] } = await db.query(`
      INSERT INTO payments (invoice_id, client_id, amount, payment_date, notes)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [invoice_id, client_id, amount, payment_date || new Date().toISOString().split('T')[0], notes]);

    // Check if invoice is fully paid
    const { rows: [inv] } = await db.query(`
      SELECT (COALESCE(SUM(li.total), 0) - (COALESCE(SUM(li.total), 0) * COALESCE(i.discount_pct, 0) / 100)) AS inv_total
      FROM invoice_line_items li 
      JOIN invoices i ON i.id = li.invoice_id
      WHERE li.invoice_id = $1
      GROUP BY i.discount_pct
    `, [invoice_id]);
    const { rows: [paid] } = await db.query(
      'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = $1',
      [invoice_id]
    );

    if (parseFloat(paid.total_paid) >= parseFloat(inv.inv_total)) {
      await db.query(`UPDATE invoices SET status = 'paid' WHERE id = $1`, [invoice_id]);
    }

    // DEDUCT invoice payment from wallet (invoice settlement reduces wallet balance)
    await db.query(`
      UPDATE clients
      SET wallet_balance = COALESCE(wallet_balance, 0) - $1
      WHERE id = $2
    `, [amount, client_id]);

    // Record in central ledger
    const { rows: [invMeta] } = await db.query('SELECT invoice_number FROM invoices WHERE id = $1', [invoice_id]);
    await db.query(`
      INSERT INTO transactions (type, amount, currency, amount_dzd, client_id, user_id, reference_id, description, transaction_date)
      VALUES ('invoice_payment', $1, 'DZD', $1, $2, $3, $4, $5, $6)
    `, [amount, client_id, req.user.id, payment.id,
        `Payment for Invoice ${invMeta?.invoice_number}`,
        payment_date || new Date().toISOString()]);

    await db.query('COMMIT');

    // Fetch invoice number for log
    const { rows: [invRow] } = await pool.query('SELECT invoice_number, client_id FROM invoices WHERE id = $1', [invoice_id]);
    await logActivity({
      clientId: invRow?.client_id,
      userId: req.user.id,
      actionType: 'invoice_settled',
      description: `Invoice ${invRow?.invoice_number} settled — ${parseFloat(amount).toFixed(2)} DZD deducted from wallet`,
    });

    // Notify client portal that invoice was paid
    if (invRow?.client_id) {
      await createPortalNotification({
        clientId: invRow.client_id,
        type: 'invoice_received',
        title: '✅ Facture règlée',
        message: `Votre facture ${invRow.invoice_number} a été règlée — ${parseFloat(amount).toLocaleString('fr-DZ')} DZD.`,
      });
    }

    res.status(201).json(payment);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// ── EXPENSES ───────────────────────────────────────────────────

// GET /api/finance/expenses/fixed
router.get('/expenses/fixed', canView('finance'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM fixed_expenses ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/expenses/fixed
router.post('/expenses/fixed', canCreate('finance'), async (req, res) => {
  const { name, amount, frequency, category } = req.body;
  if (!name || !amount || !frequency) return res.status(400).json({ error: 'name, amount, frequency required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO fixed_expenses (name, amount, frequency, category)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [name, amount, frequency, category]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finance/expenses/fixed/:id
router.put('/expenses/fixed/:id', canEdit('finance'), async (req, res) => {
  const { name, amount, frequency, category } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE fixed_expenses SET name=COALESCE($1,name), amount=COALESCE($2,amount),
        frequency=COALESCE($3,frequency), category=COALESCE($4,category)
      WHERE id=$5 RETURNING *
    `, [name, amount, frequency, category, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finance/expenses/fixed/:id
router.delete('/expenses/fixed/:id', canDelete('finance'), async (req, res) => {
  try {
    await pool.query('DELETE FROM fixed_expenses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/expenses/variable
router.get('/expenses/variable', canView('finance'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ve.*, c.company_name AS client_name
      FROM variable_expenses ve
      LEFT JOIN clients c ON c.id = ve.client_id
      ORDER BY ve.expense_date DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/expenses/variable
router.post('/expenses/variable', canCreate('finance'), async (req, res) => {
  const { name, amount, category, linked_to_client, client_id, expense_date } = req.body;
  if (!name || !amount) return res.status(400).json({ error: 'name and amount required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO variable_expenses (name, amount, category, linked_to_client, client_id, expense_date)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [name, amount, category, linked_to_client || false, client_id || null, expense_date]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finance/expenses/variable/:id
router.put('/expenses/variable/:id', canEdit('finance'), async (req, res) => {
  const { name, amount, category, linked_to_client, client_id, expense_date } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE variable_expenses SET name=COALESCE($1,name), amount=COALESCE($2,amount),
        category=COALESCE($3,category), linked_to_client=COALESCE($4,linked_to_client),
        client_id=$5, expense_date=COALESCE($6,expense_date)
      WHERE id=$7 RETURNING *
    `, [name, amount, category, linked_to_client, client_id || null, expense_date, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finance/expenses/variable/:id
router.delete('/expenses/variable/:id', canDelete('finance'), async (req, res) => {
  try {
    await pool.query('DELETE FROM variable_expenses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── P&L ────────────────────────────────────────────────────────

// GET /api/finance/pl?period=month|quarter|year&date=2026-03
router.get('/pl', canView('finance'), async (req, res) => {
  const { period = 'month', date } = req.query;
  try {
    let start, end;
    const ref = date ? new Date(date + '-01') : new Date();

    if (period === 'month') {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    } else if (period === 'quarter') {
      const q = Math.floor(ref.getMonth() / 3);
      start = new Date(ref.getFullYear(), q * 3, 1);
      end = new Date(ref.getFullYear(), q * 3 + 3, 0);
    } else {
      start = new Date(ref.getFullYear(), 0, 1);
      end = new Date(ref.getFullYear(), 11, 31);
    }

    const rateRes = await pool.query('SELECT rate FROM dzd_usd_rates ORDER BY effective_date DESC, created_at DESC LIMIT 1');
    const currentDzdRate = rateRes.rows[0] ? parseFloat(rateRes.rows[0].rate) : 135;

    const [revenue, fixedExp, varExp, adsSpend, supplierPayments, pendingDebts] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE payment_date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(
        CASE frequency
          WHEN 'monthly' THEN amount
          WHEN 'quarterly' THEN amount / 3
          WHEN 'annual' THEN amount / 12
        END
      ), 0) AS total FROM fixed_expenses`),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM variable_expenses WHERE expense_date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`SELECT COALESCE(SUM(amount_dzd), 0) AS total FROM ads_spend_logs WHERE spend_date BETWEEN $1 AND $2`, [start, end]),
      pool.query(`
        SELECT COALESCE(SUM(
          CASE 
            WHEN st.currency = 'DZD' THEN sv.amount 
            ELSE COALESCE(sv.amount_in_usd, sv.amount) * $3 
          END
        ), 0) AS total 
        FROM supplier_versements sv 
        JOIN supplier_transactions st ON st.id = sv.transaction_id
        WHERE sv.status = 'paid' AND st.status != 'cancelled' AND sv.payment_date BETWEEN $1 AND $2
      `, [start, end, currentDzdRate]),
      pool.query(`
        SELECT st.id, st.total_amount, st.currency, st.due_date, st.status, st.notes,
               s.name AS supplier_name,
               ROUND(
                 (st.total_amount - COALESCE((
                   SELECT SUM(sv.amount) FROM supplier_versements sv
                   WHERE sv.transaction_id = st.id AND sv.status = 'paid'
                 ), 0)) * CASE WHEN st.currency = 'DZD' THEN 1 ELSE $1 END, 2
               ) AS amount_remaining
        FROM supplier_transactions st
        JOIN suppliers s ON s.id = st.supplier_id
        WHERE st.status IN ('pending', 'partial', 'overdue')
        ORDER BY st.due_date ASC NULLS LAST
      `, [currentDzdRate]),
    ]);

    const revenueTotal  = parseFloat(revenue.rows[0].total);
    const fixedTotal    = parseFloat(fixedExp.rows[0].total);
    const varTotal      = parseFloat(varExp.rows[0].total);
    const adsTotal      = parseFloat(adsSpend.rows[0].total);
    const supplierTotal = parseFloat(supplierPayments.rows[0].total);
    const totalExpenses = fixedTotal + varTotal + supplierTotal;
    const netProfit     = revenueTotal - totalExpenses;

    const pendingDebtsDzd = pendingDebts.rows.reduce((sum, d) => sum + parseFloat(d.amount_remaining || 0), 0);

    res.json({
      period,
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0],
      revenue: revenueTotal,
      fixed_expenses: fixedTotal,
      variable_expenses: varTotal,
      ads_spend: adsTotal,
      supplier_payments: supplierTotal,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      margin_pct: revenueTotal > 0 ? Math.round((netProfit / revenueTotal) * 100) : 0,
      pending_debts_dzd: pendingDebtsDzd,
      pending_debts: pendingDebts.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PDF Helper ─────────────────────────────────────────────────


function generatePDF(doc, type, record, items) {
  const orange = '#f97316';
  const dark   = '#0f172a';
  const slate  = '#64748b';
  const light  = '#f8fafc';
  const W      = doc.page.width;

  // ── Accent bar ──────────────────────────────────────────
  doc.rect(0, 0, W, 6).fill(orange);

  // ── Header ──────────────────────────────────────────────
  // Brand
  doc.fill(dark).fontSize(26).font('Helvetica-Bold').text('Axialogy', 50, 28);
  doc.fontSize(10).font('Helvetica').fill(slate).text('hello@axialogy.com  ·  www.axialogy.com', 50, 58);

  // Document type badge (top-right)
  const badgeW = 130, badgeH = 40;
  doc.rect(W - 50 - badgeW, 22, badgeW, badgeH).fill(orange);
  doc.fill('#ffffff').fontSize(13).font('Helvetica-Bold')
    .text(type, W - 50 - badgeW, 22 + (badgeH - 13) / 2, { width: badgeW, align: 'center' });

  // ── Document meta ────────────────────────────────────────
  const docNum = record.quote_number || record.invoice_number || '';
  doc.fill(dark).fontSize(18).font('Helvetica-Bold').text(docNum, 50, 82);
  const dateStr = record.created_at ? new Date(record.created_at).toLocaleDateString('fr-DZ') : '';
  const dueStr  = record.due_date   ? new Date(record.due_date).toLocaleDateString('fr-DZ')  : '';
  doc.fontSize(9).font('Helvetica').fill(slate)
    .text(`Date: ${dateStr}`, 50, 105)
    .text(`Échéance: ${dueStr}`, 180, 105);

  // ── Bill To ──────────────────────────────────────────────
  doc.rect(50, 122, W - 100, 58).fill(light).stroke('#e2e8f0');
  doc.fill(orange).fontSize(8).font('Helvetica-Bold').text('FACTURÉ À', 64, 132);
  doc.fill(dark).fontSize(12).font('Helvetica-Bold').text(record.company_name || '', 64, 144);
  doc.fontSize(9).font('Helvetica').fill(slate)
    .text([record.contact_name, record.contact_email].filter(Boolean).join('  ·  '), 64, 159);

  // ── Items table ──────────────────────────────────────────
  const tableTop = 200;
  const colDesc  = 50,  wDesc  = 280;
  const colQty   = 340, wQty   = 50;
  const colPrice = 398, wPrice = 80;
  const colTotal = 485, wTotal = W - 50 - colTotal;

  // Table header
  doc.rect(50, tableTop, W - 100, 24).fill(dark);
  doc.fill('#ffffff').fontSize(9).font('Helvetica-Bold')
    .text('DESCRIPTION',  colDesc  + 4, tableTop + 7, { width: wDesc })
    .text('QTÉ',          colQty,       tableTop + 7, { width: wQty,   align: 'right' })
    .text('PRIX U. DZD',  colPrice,     tableTop + 7, { width: wPrice, align: 'right' })
    .text('TOTAL DZD',    colTotal,     tableTop + 7, { width: wTotal, align: 'right' });

  // Rows
  let y = tableTop + 30;
  let subtotal = 0;

  items.forEach((item, i) => {
    const rowH = 22;
    // Add new page if needed (keep 140px for totals + footer)
    if (y + rowH > doc.page.height - 140) {
      doc.addPage();
      doc.rect(0, 0, W, 6).fill(orange);
      y = 40;
      // Re-draw table header on new page
      doc.rect(50, y, W - 100, 24).fill(dark);
      doc.fill('#ffffff').fontSize(9).font('Helvetica-Bold')
        .text('DESCRIPTION',  colDesc  + 4, y + 7, { width: wDesc })
        .text('QTÉ',          colQty,       y + 7, { width: wQty,   align: 'right' })
        .text('PRIX U. DZD',  colPrice,     y + 7, { width: wPrice, align: 'right' })
        .text('TOTAL DZD',    colTotal,     y + 7, { width: wTotal, align: 'right' });
      y += 30;
    }

    if (i % 2 === 1) doc.rect(50, y - 4, W - 100, rowH).fill('#f1f5f9');
    const total = parseFloat(item.total ?? (parseFloat(item.quantity) * parseFloat(item.unit_price)));
    subtotal += total;
    doc.fill(dark).font('Helvetica').fontSize(9)
      .text(item.description || '', colDesc + 4, y, { width: wDesc - 4 })
      .text(parseFloat(item.quantity).toString(), colQty,   y, { width: wQty,   align: 'right' })
      .text(parseFloat(item.unit_price).toFixed(2), colPrice, y, { width: wPrice, align: 'right' })
      .text(total.toFixed(2), colTotal, y, { width: wTotal, align: 'right' });
    y += rowH;
  });

  // ── Totals block ─────────────────────────────────────────
  y += 10;
  const discountPct = parseFloat(record.discount_pct || 0);
  const discountAmt = subtotal * discountPct / 100;
  const grandTotal  = subtotal - discountAmt;

  const totalsX = W - 50 - 220;
  const totalsW = 220;

  const drawTotalRow = (label, value, bold = false, highlight = false) => {
    if (highlight) {
      doc.rect(totalsX, y, totalsW, 26).fill(orange);
      doc.fill('#ffffff').fontSize(11).font('Helvetica-Bold')
        .text(label, totalsX + 10, y + 7, { width: 110 })
        .text(value,  totalsX + 120, y + 7, { width: totalsW - 130, align: 'right' });
    } else {
      doc.fill(slate).fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, totalsX + 10, y + 5, { width: 110 })
        .text(value,  totalsX + 120, y + 5, { width: totalsW - 130, align: 'right' });
      doc.moveTo(totalsX, y + 18).lineTo(totalsX + totalsW, y + 18).stroke('#e2e8f0');
    }
    y += highlight ? 30 : 20;
  };

  drawTotalRow('Sous-total', `${subtotal.toFixed(2)} DZD`);
  if (discountPct > 0) drawTotalRow(`Remise (${discountPct}%)`, `-${discountAmt.toFixed(2)} DZD`);
  drawTotalRow('TOTAL DÛ', `${grandTotal.toFixed(2)} DZD`, true, true);

  // ── Notes ────────────────────────────────────────────────
  if (record.notes) {
    y += 10;
    doc.fill(orange).fontSize(8).font('Helvetica-Bold').text('NOTES', 50, y);
    doc.fill(dark).fontSize(9).font('Helvetica').text(record.notes, 50, y + 12, { width: W - 100 });
  }

  // ── Footer (bottom of page) ───────────────────────────────
  const footerY = doc.page.height - 36;
  doc.rect(0, footerY, W, 36).fill(light);
  doc.fill(slate).fontSize(8).font('Helvetica')
    .text('Merci pour votre confiance  ·  Axialogy — Document confidentiel', 50, footerY + 12,
      { width: W - 100, align: 'center' });
}

// ── SERVICE PRICES ──────────────────────────────────────────────

// GET /api/finance/service-prices
router.get('/service-prices', canView('finance'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM service_prices ORDER BY service_name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/service-prices
router.post('/service-prices', isAdmin(), async (req, res) => {
  const { service_name, service_key, price_dzd, description } = req.body;
  if (!service_name || !price_dzd) return res.status(400).json({ error: 'service_name and price_dzd are required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO service_prices (service_name, service_key, price_dzd, description, updated_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (service_key) DO UPDATE
        SET service_name = EXCLUDED.service_name,
            price_dzd = EXCLUDED.price_dzd,
            description = EXCLUDED.description,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
      RETURNING *
    `, [service_name, service_key || service_name.toLowerCase().replace(/\s+/g, '_'), price_dzd, description || null, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finance/service-prices/:id
router.put('/service-prices/:id', isAdmin(), async (req, res) => {
  const { service_name, price_dzd, description } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE service_prices
      SET service_name = COALESCE($1, service_name),
          price_dzd = COALESCE($2, price_dzd),
          description = COALESCE($3, description),
          updated_by = $4,
          updated_at = NOW()
      WHERE id = $5 RETURNING *
    `, [service_name, price_dzd, description, req.user.id, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finance/service-prices/:id
router.delete('/service-prices/:id', isAdmin(), async (req, res) => {
  try {
    await pool.query('DELETE FROM service_prices WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.generatePDF = generatePDF;

