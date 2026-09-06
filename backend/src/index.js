require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────
// Exact-match origins only. `startsWith` previously allowed
// https://management.edumanage.app.attacker.com, and the blanket `.vercel.app`
// rule allowed every Vercel deployment on the internet.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://management.edumanage.app', // production custom domain
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
].filter(Boolean);

// Opt-in only, e.g. VERCEL_PREVIEW_ORIGIN=https://school-management-git-x.vercel.app
if (process.env.VERCEL_PREVIEW_ORIGIN) {
  allowedOrigins.push(...process.env.VERCEL_PREVIEW_ORIGIN.split(',').map(o => o.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl / server-to-server calls
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(compression()); // gzip all responses — ~60-70% smaller JSON payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Public Routes (no auth) ────────────────────────────────────
// routes/portal.js and routes/supplier-portal.js do not exist in this repo.
// They are mounted optionally further down; requiring them here crashed boot.

// ── Core Routes ────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/dashboard',  require('./routes/dashboard'));

// ── School Routes ──────────────────────────────────────────────
app.use('/api/students',   require('./routes/students'));
app.use('/api/teachers',   require('./routes/teachers'));
app.use('/api/classes',    require('./routes/classes'));
app.use('/api/groups',     require('./routes/groups'));
app.use('/api/subjects',   require('./routes/subjects'));
app.use('/api/parents',    require('./routes/parents'));

// ── Finance Routes ─────────────────────────────────────────────
app.use('/api/finance',    require('./routes/finance'));

// ── Management Routes ──────────────────────────────────────────
app.use('/api/team',          require('./routes/team'));
app.use('/api/notifications', require('./routes/notifications'));

// ── Legacy backward-compat aliases (portal still uses /portal/:token) ──
try { app.use('/api/portal', require('./routes/portal')); } catch(e) {}
try { app.use('/api/supplier-portal', require('./routes/supplier-portal')); } catch(e) {}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'EduManage API' });
});



// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler. Details go to the server log, never to the client —
// err.message routinely contains table and column names.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.originalUrl, err.stack || err);
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  res.status(500).json({ error: 'Internal server error' });
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

