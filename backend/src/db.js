const { Pool } = require('pg');
require('dotenv').config();

// On Vercel every warm serverless instance holds its OWN pool, so the pool size
// is per-instance, not per-app. The previous max of 20 meant two warm instances
// alone asked Supabase for 40 connections against a session-mode ceiling of 15,
// which is what produced:
//   (EMAXCONNSESSION) max clients reached in session mode - pool_size: 15
// Keep it tiny on serverless and let the instance count do the scaling.
const isServerless = Boolean(process.env.VERCEL);

const max = Number.parseInt(
  process.env.PG_POOL_MAX || (isServerless ? '2' : '10'),
  10
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL on all connections
  max,
  // Release connections quickly on serverless so a scaled-down instance stops
  // holding a slot the next request needs.
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
  connectionTimeoutMillis: 10_000,
  // Let the process exit when nothing is in flight instead of pinning a client.
  allowExitOnIdle: isServerless,
  keepAlive: true,
});

// A transient error on an idle client must not take the API down. The previous
// process.exit(-1) turned one dropped connection into a dead server locally and
// a failed invocation on Vercel — pg already discards the broken client and the
// pool replaces it.
pool.on('error', (err) => {
  console.error('[db] idle client error (pool will recover):', err.message);
});

module.exports = pool;
