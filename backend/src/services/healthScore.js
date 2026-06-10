const pool = require('../db');

/**
 * Calculates the health score for a client based on three signals:
 * 1. Payments - overdue invoices
 * 2. Delivery - task deadlines
 * 3. Ads - spend vs budget
 */
async function calculateClientHealth(clientId) {
  const scores = [];

  // Signal 1: Payment health
  const paymentRes = await pool.query(`
    SELECT 
      i.id,
      i.status,
      i.due_date,
      COALESCE(SUM(ili.total), 0) AS invoice_total,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
    FROM invoices i
    LEFT JOIN invoice_line_items ili ON ili.invoice_id = i.id
    WHERE i.client_id = $1 AND i.status != 'draft'
    GROUP BY i.id
  `, [clientId]);

  let paymentScore = 'green';
  for (const inv of paymentRes.rows) {
    const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date)) / 86400000);
    const isPaid = parseFloat(inv.paid_amount) >= parseFloat(inv.invoice_total);
    if (!isPaid && daysOverdue >= 15) {
      paymentScore = 'red';
      break;
    } else if (!isPaid && daysOverdue >= 1 && daysOverdue < 15) {
      paymentScore = 'yellow';
    }
  }
  scores.push(paymentScore);

  // Signal 2: Delivery health (task deadlines)
  const taskRes = await pool.query(`
    SELECT deadline, status FROM tasks
    WHERE client_id = $1 AND status NOT IN ('done')
  `, [clientId]);

  let deliveryScore = 'green';
  for (const task of taskRes.rows) {
    if (!task.deadline) continue;
    const daysUntilDue = Math.floor((new Date(task.deadline) - Date.now()) / 86400000);
    if (daysUntilDue < 0) {
      deliveryScore = 'red';
      break;
    } else if (daysUntilDue <= 2) {
      deliveryScore = 'yellow';
    }
  }
  scores.push(deliveryScore);

  // Signal 3: Ads health — based on wallet balance vs total ads spent in DZD
  const walletRes = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'invoice_payment' THEN amount_dzd ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type IN ('ad_spend', 'overdue_deduction') THEN amount_dzd ELSE 0 END), 0)
      AS wallet_balance
    FROM transactions WHERE client_id = $1
  `, [clientId]);
  const walletBalance = parseFloat(walletRes.rows[0]?.wallet_balance || 0);

  let adsScore = 'green';
  // If wallet is negative (overdrawn), it's red
  // If wallet has less than 10% of total DZD ever received (low buffer), yellow
  const totalPaidRes = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE client_id = $1',
    [clientId]
  );
  const totalPaid = parseFloat(totalPaidRes.rows[0]?.total || 0);
  if (walletBalance < 0) {
    adsScore = 'red';
  } else if (totalPaid > 0 && walletBalance < totalPaid * 0.10) {
    adsScore = 'yellow';
  }
  scores.push(adsScore);

  // Overall: any red = red, all green = green, otherwise yellow
  if (scores.includes('red')) return 'red';
  if (scores.every(s => s === 'green')) return 'green';
  return 'yellow';
}

/**
 * Returns the health score + per-signal breakdown for the client detail view.
 */
async function calculateClientHealthWithSignals(clientId) {
  const signals = [];

  // Signal 1: Payment
  const paymentRes = await pool.query(`
    SELECT i.id, i.status, i.due_date,
      COALESCE(SUM(ili.total), 0) AS invoice_total,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
    FROM invoices i
    LEFT JOIN invoice_line_items ili ON ili.invoice_id = i.id
    WHERE i.client_id = $1 AND i.status != 'draft'
    GROUP BY i.id
  `, [clientId]);

  let paymentScore = 'green';
  let paymentReason = 'No overdue invoices';
  for (const inv of paymentRes.rows) {
    const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date)) / 86400000);
    const isPaid = parseFloat(inv.paid_amount) >= parseFloat(inv.invoice_total);
    if (!isPaid && daysOverdue >= 15) { paymentScore = 'red'; paymentReason = `Invoice overdue by ${daysOverdue} days`; break; }
    else if (!isPaid && daysOverdue >= 1) { paymentScore = 'yellow'; paymentReason = `Invoice overdue by ${daysOverdue} days`; }
  }
  signals.push({ name: 'Payments', score: paymentScore, reason: paymentReason });

  // Signal 2: Delivery
  const taskRes = await pool.query(
    `SELECT deadline, status FROM tasks WHERE client_id = $1 AND status NOT IN ('done')`, [clientId]
  );
  let deliveryScore = 'green';
  let deliveryReason = 'All tasks on track';
  for (const task of taskRes.rows) {
    if (!task.deadline) continue;
    const daysUntilDue = Math.floor((new Date(task.deadline) - Date.now()) / 86400000);
    if (daysUntilDue < 0) { deliveryScore = 'red'; deliveryReason = `Task overdue by ${Math.abs(daysUntilDue)} days`; break; }
    else if (daysUntilDue <= 2) { deliveryScore = 'yellow'; deliveryReason = `Task due in ${daysUntilDue} day(s)`; }
  }
  signals.push({ name: 'Delivery', score: deliveryScore, reason: deliveryReason });

  // Signal 3: Ads — wallet balance based
  const walletRes2 = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'invoice_payment' THEN amount_dzd ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type IN ('ad_spend', 'overdue_deduction') THEN amount_dzd ELSE 0 END), 0)
      AS wallet_balance
    FROM transactions WHERE client_id = $1
  `, [clientId]);
  const walletBalance2 = parseFloat(walletRes2.rows[0]?.wallet_balance || 0);

  const totalPaidRes2 = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE client_id = $1',
    [clientId]
  );
  const totalPaid2 = parseFloat(totalPaidRes2.rows[0]?.total || 0);

  let adsScore = 'green';
  let adsReason = 'Wallet balance healthy';
  if (walletBalance2 < 0) {
    adsScore = 'red';
    adsReason = `Wallet overdrawn by ${Math.abs(walletBalance2).toLocaleString()} DZD`;
  } else if (totalPaid2 > 0 && walletBalance2 < totalPaid2 * 0.10) {
    adsScore = 'yellow';
    adsReason = `Low wallet balance: ${walletBalance2.toLocaleString()} DZD remaining`;
  } else {
    adsReason = `Wallet: ${walletBalance2.toLocaleString()} DZD available`;
  }
  signals.push({ name: 'Ads Budget', score: adsScore, reason: adsReason });

  const scores = signals.map(s => s.score);
  let overall = 'green';
  if (scores.includes('red')) overall = 'red';
  else if (!scores.every(s => s === 'green')) overall = 'yellow';

  return { overall, signals };
}

module.exports = { calculateClientHealth, calculateClientHealthWithSignals };
