const express = require('express');
const { pool } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();

    // Totals for selected month
    const totals = await pool.query(
      `SELECT type, COALESCE(SUM(amount), 0) as total 
       FROM transactions 
       WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3 
       GROUP BY type`,
      [req.userId, month, year]
    );

    let totalIncome = 0, totalExpense = 0;
    totals.rows.forEach(r => {
      if (r.type === 'income') totalIncome = parseFloat(r.total);
      if (r.type === 'expense') totalExpense = parseFloat(r.total);
    });

    // Monthly chart (last 6 months)
    const monthlyChart = await pool.query(
      `SELECT 
        TO_CHAR(date, 'Mon') as month,
        EXTRACT(MONTH FROM date) as month_num,
        EXTRACT(YEAR FROM date) as year_num,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
       FROM transactions 
       WHERE user_id = $1 AND date >= (CURRENT_DATE - INTERVAL '6 months')
       GROUP BY TO_CHAR(date, 'Mon'), EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date)
       ORDER BY year_num, month_num`,
      [req.userId]
    );

    // Category chart for expenses this month
    const categoryChart = await pool.query(
      `SELECT c.name, c.color, COALESCE(SUM(t.amount), 0) as value
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense' 
         AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3
       GROUP BY c.name, c.color
       ORDER BY value DESC`,
      [req.userId, month, year]
    );

    // Recent transactions
    const recent = await pool.query(
      `SELECT t.*, c.name as category_name 
       FROM transactions t 
       LEFT JOIN categories c ON t.category_id = c.id 
       WHERE t.user_id = $1 AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3
       ORDER BY t.date DESC, t.created_at DESC 
       LIMIT 10`,
      [req.userId, month, year]
    );

    res.json({
      totalIncome,
      totalExpense,
      monthlyChart: monthlyChart.rows.map(r => ({
        month: r.month,
        income: parseFloat(r.income),
        expense: parseFloat(r.expense),
      })),
      categoryChart: categoryChart.rows.map(r => ({
        name: r.name,
        value: parseFloat(r.value),
      })),
      recentTransactions: recent.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao carregar dashboard' });
  }
});

module.exports = router;
