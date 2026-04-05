const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// List fixed expenses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fe.*, c.name as category_name 
       FROM fixed_expenses fe 
       LEFT JOIN categories c ON fe.category_id = c.id 
       WHERE fe.user_id = $1 
       ORDER BY fe.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar gastos fixos' });
  }
});

// Create fixed expense + generate recurring transactions
router.post('/', [
  body('description').trim().notEmpty().withMessage('Descrição é obrigatória').isLength({ max: 100 }),
  body('amount').isFloat({ gt: 0 }).withMessage('Valor deve ser maior que zero'),
  body('category_id').isUUID().withMessage('Categoria inválida'),
  body('start_date').isISO8601().withMessage('Data inválida'),
  body('recurrence_months').isInt({ min: 1, max: 120 }).withMessage('Meses de recorrência deve ser entre 1 e 120'),
], validate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { description, amount, category_id, start_date, recurrence_months } = req.body;
    await client.query('BEGIN');

    // Create fixed expense
    const feResult = await client.query(
      `INSERT INTO fixed_expenses (description, amount, category_id, user_id, start_date, recurrence_months)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [description, amount, category_id, req.userId, start_date, recurrence_months]
    );
    const fixedExpense = feResult.rows[0];

    // Generate recurring transactions
    const startDate = new Date(start_date);
    for (let i = 0; i < recurrence_months; i++) {
      const txDate = new Date(startDate);
      txDate.setMonth(txDate.getMonth() + i);
      await client.query(
        `INSERT INTO transactions (description, amount, type, category_id, user_id, date, fixed_expense_id)
         VALUES ($1, $2, 'expense', $3, $4, $5, $6)`,
        [description, amount, category_id, req.userId, txDate.toISOString().split('T')[0], fixedExpense.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(fixedExpense);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar gasto fixo' });
  } finally {
    client.release();
  }
});

// Update fixed expense
router.put('/:id', [
  body('description').optional().trim().notEmpty().isLength({ max: 100 }),
  body('amount').optional().isFloat({ gt: 0 }),
  body('category_id').optional().isUUID(),
  body('start_date').optional().isISO8601(),
  body('recurrence_months').optional().isInt({ min: 1, max: 120 }),
], validate, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount, category_id, start_date, recurrence_months } = req.body;
    const result = await pool.query(
      `UPDATE fixed_expenses SET 
        description = COALESCE($1, description), 
        amount = COALESCE($2, amount),
        category_id = COALESCE($3, category_id), 
        start_date = COALESCE($4, start_date), 
        recurrence_months = COALESCE($5, recurrence_months)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [description, amount, category_id, start_date, recurrence_months, id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Gasto fixo não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar gasto fixo' });
  }
});

// Delete fixed expense (and related future transactions)
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete future transactions linked to this fixed expense
    await client.query(
      `DELETE FROM transactions WHERE fixed_expense_id = $1 AND user_id = $2 AND date >= CURRENT_DATE`,
      [req.params.id, req.userId]
    );
    const result = await client.query(
      'DELETE FROM fixed_expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Gasto fixo não encontrado' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Gasto fixo excluído' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Erro ao excluir gasto fixo' });
  } finally {
    client.release();
  }
});

module.exports = router;
