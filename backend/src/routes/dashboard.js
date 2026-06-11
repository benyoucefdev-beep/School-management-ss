const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userId  = req.user.id;

    const [
      totalStudents,
      totalTeachers,
      totalGroups,
      totalSubjects,
      activeClasses,
      overdueInvoices,
      revenueThisMonth,
      expensesThisMonth,
      absencesThisMonth,
      recentActivity,
      pendingSubjectPayments,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM students WHERE status = 'active'`),
      pool.query(`SELECT COUNT(*) FROM teachers WHERE is_active = TRUE`),
      pool.query(`SELECT COUNT(*) FROM groups WHERE is_active = TRUE`),
      pool.query(`SELECT COUNT(*) FROM subjects WHERE is_active = TRUE`),
      pool.query(
        isAdmin
          ? `SELECT COUNT(*) FROM classes WHERE status NOT IN ('done','completed','cancelled')`
          : `SELECT COUNT(*) FROM classes WHERE status NOT IN ('done','completed','cancelled') AND $1 = ANY(teacher_ids)`,
        isAdmin ? [] : [userId]
      ),
      pool.query(`SELECT COUNT(*) FROM invoices WHERE status = 'overdue'`),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS total FROM payments
        WHERE DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)
      `),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
        WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
      `),
      pool.query(`
        SELECT COUNT(*) FROM absences
        WHERE DATE_TRUNC('month', absence_date) = DATE_TRUNC('month', CURRENT_DATE)
          AND is_justified = FALSE
      `),
      pool.query(`
        SELECT al.*, u.name AS user_name, s.full_name AS student_name
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        LEFT JOIN students s ON s.id = al.student_id
        ORDER BY al.created_at DESC LIMIT 12
      `),
      pool.query(`SELECT COUNT(*) FROM subject_payments WHERE status = 'pending' AND due_date <= CURRENT_DATE`),
    ]);

    const revenue  = parseFloat(revenueThisMonth.rows[0].total);
    const expenses = parseFloat(expensesThisMonth.rows[0].total);

    // Top groups by student count
    const { rows: topGroups } = await pool.query(`
      SELECT g.id, g.name, g.level,
        COUNT(sg.student_id) AS student_count,
        g.max_students
      FROM groups g
      LEFT JOIN student_groups sg ON sg.group_id = g.id
      GROUP BY g.id ORDER BY student_count DESC LIMIT 5
    `);

    // Subject fee collection rate
    const { rows: feeStats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid')    AS paid,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'overdue') AS overdue
      FROM subject_payments
      WHERE DATE_TRUNC('month', due_date) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    res.json({
      stats: {
        total_students:          parseInt(totalStudents.rows[0].count),
        total_teachers:          parseInt(totalTeachers.rows[0].count),
        total_groups:            parseInt(totalGroups.rows[0].count),
        total_subjects:          parseInt(totalSubjects.rows[0].count),
        active_classes:          parseInt(activeClasses.rows[0].count),
        overdue_invoices:        parseInt(overdueInvoices.rows[0].count),
        revenue_this_month:      revenue,
        expenses_this_month:     expenses,
        net_profit_this_month:   revenue - expenses,
        absences_this_month:     parseInt(absencesThisMonth.rows[0].count),
        pending_fees:            parseInt(pendingSubjectPayments.rows[0].count),
      },
      recent_activity: recentActivity.rows,
      top_groups:      topGroups,
      fee_stats:       feeStats[0] || { paid: 0, pending: 0, overdue: 0 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
