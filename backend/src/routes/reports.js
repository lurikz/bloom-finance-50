const express = require('express');
const { pool } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/reports/monthly?month=4&year=2026
router.get('/monthly', async (req, res) => {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();

    // Totals
    const totals = await pool.query(
      `SELECT type, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM transactions 
       WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3 
       GROUP BY type`,
      [req.userId, month, year]
    );

    let totalIncome = 0, totalExpense = 0, incomeCount = 0, expenseCount = 0;
    totals.rows.forEach(r => {
      if (r.type === 'income') { totalIncome = parseFloat(r.total); incomeCount = parseInt(r.count); }
      if (r.type === 'expense') { totalExpense = parseFloat(r.total); expenseCount = parseInt(r.count); }
    });

    // By category
    const byCategory = await pool.query(
      `SELECT c.name as category, t.type,
              COALESCE(SUM(t.amount), 0) as total,
              COUNT(*) as count
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 
         AND EXTRACT(MONTH FROM t.date) = $2 
         AND EXTRACT(YEAR FROM t.date) = $3
       GROUP BY c.name, t.type
       ORDER BY total DESC`,
      [req.userId, month, year]
    );

    // Daily breakdown
    const daily = await pool.query(
      `SELECT date,
              COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
       FROM transactions
       WHERE user_id = $1 
         AND EXTRACT(MONTH FROM date) = $2 
         AND EXTRACT(YEAR FROM date) = $3
       GROUP BY date
       ORDER BY date`,
      [req.userId, month, year]
    );

    // Top expenses
    const topExpenses = await pool.query(
      `SELECT t.description, t.amount, t.date, c.name as category
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense'
         AND EXTRACT(MONTH FROM t.date) = $2 
         AND EXTRACT(YEAR FROM t.date) = $3
       ORDER BY t.amount DESC
       LIMIT 10`,
      [req.userId, month, year]
    );

    res.json({
      month,
      year,
      summary: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        incomeCount,
        expenseCount,
        totalTransactions: incomeCount + expenseCount,
      },
      byCategory: byCategory.rows.map(r => ({
        category: r.category,
        type: r.type,
        total: parseFloat(r.total),
        count: parseInt(r.count),
      })),
      daily: daily.rows.map(r => ({
        date: r.date,
        income: parseFloat(r.income),
        expense: parseFloat(r.expense),
      })),
      topExpenses: topExpenses.rows.map(r => ({
        description: r.description,
        amount: parseFloat(r.amount),
        date: r.date,
        category: r.category,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao gerar relatório' });
  }
});

module.exports = router;
