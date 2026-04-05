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

// List
router.get('/', async (req, res) => {
  try {
    const { month, year, type, category, search, min_amount, max_amount, date_from, date_to } = req.query;
    let query = `
      SELECT t.*, c.name as category_name 
      FROM transactions t 
      LEFT JOIN categories c ON t.category_id = c.id 
      WHERE t.user_id = $1
    `;
    const params = [req.userId];
    let idx = 2;

    // Month/year filter (ignored if custom date range is provided)
    if (!date_from && !date_to && month && year) {
      query += ` AND EXTRACT(MONTH FROM t.date) = $${idx} AND EXTRACT(YEAR FROM t.date) = $${idx + 1}`;
      params.push(Number(month), Number(year));
      idx += 2;
    }
    if (type && (type === 'income' || type === 'expense')) {
      query += ` AND t.type = $${idx}`;
      params.push(type);
      idx++;
    }
    if (category) {
      query += ` AND t.category_id = $${idx}`;
      params.push(category);
      idx++;
    }
    if (search && typeof search === 'string' && search.trim()) {
      query += ` AND t.description ILIKE $${idx}`;
      params.push(`%${search.trim()}%`);
      idx++;
    }
    if (min_amount && !isNaN(Number(min_amount))) {
      query += ` AND t.amount >= $${idx}`;
      params.push(Number(min_amount));
      idx++;
    }
    if (max_amount && !isNaN(Number(max_amount))) {
      query += ` AND t.amount <= $${idx}`;
      params.push(Number(max_amount));
      idx++;
    }
    if (date_from) {
      query += ` AND t.date >= $${idx}`;
      params.push(date_from);
      idx++;
    }
    if (date_to) {
      query += ` AND t.date <= $${idx}`;
      params.push(date_to);
      idx++;
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar transações' });
  }
});

// Create
router.post('/', [
  body('description').trim().notEmpty().withMessage('Descrição é obrigatória').isLength({ max: 100 }),
  body('amount').isFloat({ gt: 0 }).withMessage('Valor deve ser maior que zero'),
  body('type').isIn(['income', 'expense']).withMessage('Tipo inválido'),
  body('category_id').isUUID().withMessage('Categoria inválida'),
  body('date').isISO8601().withMessage('Data inválida'),
], validate, async (req, res) => {
  try {
    const { description, amount, type, category_id, date } = req.body;
    const result = await pool.query(
      `INSERT INTO transactions (description, amount, type, category_id, user_id, date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [description, amount, type, category_id, req.userId, date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar transação' });
  }
});

// Update
router.put('/:id', [
  body('description').optional().trim().notEmpty().isLength({ max: 100 }),
  body('amount').optional().isFloat({ gt: 0 }),
  body('type').optional().isIn(['income', 'expense']),
  body('category_id').optional().isUUID(),
  body('date').optional().isISO8601(),
], validate, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount, type, category_id, date } = req.body;
    const result = await pool.query(
      `UPDATE transactions SET description = COALESCE($1, description), amount = COALESCE($2, amount), 
       type = COALESCE($3, type), category_id = COALESCE($4, category_id), date = COALESCE($5, date) 
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [description, amount, type, category_id, date, id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Transação não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar transação' });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Transação não encontrada' });
    res.json({ message: 'Excluída' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao excluir transação' });
  }
});

module.exports = router;
