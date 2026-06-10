const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete, isAdmin } = require('../middleware/rbac');

router.use(authenticate);

// ── Analytics (must be before /:id routes) ─────────────────────
router.get('/analytics', canView('pipeline'), async (req, res) => {
  try {
    const { rows: stageCounts } = await pool.query(
      `SELECT stage, COUNT(*) AS count FROM leads GROUP BY stage`
    );
    const totalRes = await pool.query(`SELECT COUNT(*) AS total FROM leads`);
    const wonRes   = await pool.query(`SELECT COUNT(*) AS won FROM leads WHERE stage = 'won'`);
    const total = parseInt(totalRes.rows[0].total, 10);
    const won   = parseInt(wonRes.rows[0].won, 10);

    const { rows: lostReasons } = await pool.query(
      `SELECT lost_reason, COUNT(*) AS count
         FROM leads WHERE stage = 'lost' AND lost_reason IS NOT NULL
         GROUP BY lost_reason ORDER BY count DESC`
    );

    res.json({
      total,
      won,
      conversion_rate: total > 0 ? Math.round((won / total) * 100) : 0,
      by_stage: stageCounts,
      lost_reasons: lostReasons,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads
router.get('/', canView('pipeline'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, u.name AS assigned_name, u.photo_url AS assigned_photo
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_to
         ORDER BY l.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/:id
router.get('/:id', canView('pipeline'), async (req, res) => {
  try {
    const { rows: [lead] } = await pool.query(
      `SELECT l.*, u.name AS assigned_name
         FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
         WHERE l.id = $1`, [req.params.id]
    );
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { rows: proposals } = await pool.query(
      `SELECT lp.*, q.quote_number, q.status AS quote_status
         FROM lead_proposals lp
         LEFT JOIN quotations q ON q.id = lp.quotation_id
         WHERE lp.lead_id = $1 ORDER BY lp.attached_at DESC`, [req.params.id]
    );

    res.json({ ...lead, proposals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads — owner only create
router.post('/', canCreate('pipeline'), async (req, res) => {
  const { name, company, source_channel, assigned_to, stage } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO leads (name, company, source_channel, assigned_to, stage)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, company || null, source_channel || null, assigned_to || null, stage || 'new_lead']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/leads/:id — owner only update
router.put('/:id', canEdit('pipeline'), async (req, res) => {
  const { name, company, source_channel, assigned_to } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE leads
       SET name = COALESCE($1, name),
           company = COALESCE($2, company),
           source_channel = COALESCE($3, source_channel),
           assigned_to = COALESCE($4, assigned_to)
       WHERE id = $5 RETURNING *`,
      [name, company, source_channel, assigned_to, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id/stage — owner only stage update
router.patch('/:id/stage', canEdit('pipeline'), async (req, res) => {
  const { stage, lost_reason } = req.body;
  if (!stage) return res.status(400).json({ error: 'stage is required' });
  if (stage === 'lost' && !lost_reason)
    return res.status(400).json({ error: 'lost_reason is required when marking as lost' });

  try {
    const { rows } = await pool.query(
      `UPDATE leads
       SET stage = $1,
           lost_reason = CASE WHEN $1 = 'lost' THEN $2 ELSE lost_reason END
       WHERE id = $3 RETURNING *`,
      [stage, lost_reason || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/convert — convert Won lead to client
router.post('/:id/convert', canCreate('pipeline'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [lead] } = await client.query(
      `SELECT * FROM leads WHERE id = $1`, [req.params.id]
    );
    if (!lead) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Lead not found' }); }
    if (lead.stage !== 'won') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Only Won leads can be converted' }); }
    if (lead.converted_client_id) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Lead already converted' }); }

    // Create client record
    const { rows: [newClient] } = await client.query(
      `INSERT INTO clients (company_name, contact_name)
       VALUES ($1, $2) RETURNING *`,
      [lead.company || lead.name, lead.name]
    );

    // Link proposal/quotation to new client if exists
    const { rows: proposals } = await client.query(
      `SELECT * FROM lead_proposals WHERE lead_id = $1 LIMIT 1`, [lead.id]
    );
    if (proposals[0]?.quotation_id) {
      await client.query(
        `UPDATE quotations SET client_id = $1 WHERE id = $2`,
        [newClient.id, proposals[0].quotation_id]
      );
    }

    // Update lead
    await client.query(
      `UPDATE leads SET converted_client_id = $1 WHERE id = $2`,
      [newClient.id, lead.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ client_id: newClient.id, client: newClient });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/leads/:id — owner only
router.delete('/:id', canDelete('pipeline'), async (req, res) => {
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
