// backend/src/jobs/attendanceCron.js
// Local/Docker only. On Vercel the sweep runs via GET /api/attendance/cron,
// because serverless functions do not keep a long-lived process alive.
const cron = require('node-cron');
const { markAbsences } = require('../services/attendance');

function startAttendanceCron() {
  // Every 15 minutes: any session that has ended without a scan becomes absent.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const created = await markAbsences({});
      if (created.length) console.log(`[CRON] Attendance: ${created.length} student(s) marked absent`);
    } catch (err) {
      console.error('[CRON] Attendance sweep failed:', err.message);
    }
  });
  console.log('[CRON] Attendance absence sweep scheduled (every 15 minutes).');
}

module.exports = { startAttendanceCron };
