require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────
// Modify line 10-13 in backend/src/index.js
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://management.edumanage.app', // production custom domain
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
].filter(Boolean);


app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl / Vercel serverless internal calls
    if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true); // preview deployments
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(compression()); // gzip all responses — ~60-70% smaller JSON payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Public Routes (no auth) — MUST be before authenticated routes ──
app.use('/api/portal', require('./routes/portal'));
app.use('/api/supplier-portal', require('./routes/supplier-portal'));

// ── Routes — Phase 1 & 2 ───────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/ads', require('./routes/ads'));

app.use('/api/dashboard', require('./routes/dashboard'));

// ── Routes — Phase 3 & 4 ───────────────────────────────────────
app.use('/api/team', require('./routes/team'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/digest', require('./routes/digest'));
app.use('/api/leads', require('./routes/leads'));

// ── Routes — Suppliers ──────────────────────────────────────────
try {
  app.use('/api/exchange-rates', require('./routes/exchangeRates'));
  app.use('/api/suppliers', require('./routes/suppliers'));
  app.use('/api/suppliers/:id/transactions', require('./routes/supplierTransactions'));
  app.use('/api/suppliers/:id/orders', require('./routes/supplierOrders'));
  app.use('/api/suppliers/:id/subscriptions', require('./routes/supplierSubscriptions'));
  app.use('/api/suppliers/:id/documents', require('./routes/supplierDocuments'));
} catch (e) {
  console.error('[startup] Supplier routes failed to load:', e.message);
}

// ── Routes — School Management ──────────────────────────────────
try {
  app.use('/api/groups',   require('./routes/groups'));
  app.use('/api/subjects', require('./routes/subjects'));
  app.use('/api/parents',  require('./routes/parents'));
} catch (e) {
  console.error('[startup] School routes failed to load:', e.message);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'EduManage API' });
});



// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});


// ── Start Server ────────────────────────────────────────────────
// Only start the internal cron/listen if NOT on Vercel (Local/Docker)
if (!process.env.VERCEL) {
  const { startInvoiceCron } = require('./jobs/invoiceCron');
  const { startDailyNotificationCron } = require('./jobs/notificationCron');
  const { startWeeklyDigestCron } = require('./jobs/weeklyDigestCron');
  const { startSupplierCron } = require('./jobs/supplierCron');

  app.listen(PORT, () => {
    console.log(`\n🚀 EduManage API running on http://localhost:${PORT}`);
    startInvoiceCron();
    startDailyNotificationCron();
    startWeeklyDigestCron();
    startSupplierCron();
  });
}

module.exports = app;

