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

// List all savings for user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM savings WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(result.rows.map(r => ({
      ...r,
      current_amount: parseFloat(r.current_amount),
      target_amount: r.target_amount ? parseFloat(r.target_amount) : null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar economias' });
  }
});

// Create saving
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório').isLength({ max: 100 }),
  body('target_amount').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Valor objetivo deve ser maior que zero'),
], validate, async (req, res) => {
  try {
    const { name, target_amount } = req.body;
    const result = await pool.query(
      `INSERT INTO savings (name, target_amount, user_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, target_amount || null, req.userId]
    );
    const row = result.rows[0];
    res.status(201).json({
      ...row,
      current_amount: parseFloat(row.current_amount),
      target_amount: row.target_amount ? parseFloat(row.target_amount) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar economia' });
  }
});

// Deposit into saving
router.post('/:id/deposit', [
  body('amount').isFloat({ gt: 0 }).withMessage('Valor deve ser maior que zero'),
  body('description').optional().trim().isLength({ max: 100 }),
], validate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { amount, description } = req.body;
    const savingId = req.params.id;

    // Verify ownership
    const saving = await client.query('SELECT * FROM savings WHERE id = $1 AND user_id = $2', [savingId, req.userId]);
    if (saving.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Economia não encontrada' });
    }

    // Update saving amount
    await client.query(
      'UPDATE savings SET current_amount = current_amount + $1 WHERE id = $2',
      [amount, savingId]
    );

    const txDescription = description || `Depósito em ${saving.rows[0].name}`;

    // Record movement
    await client.query(
      `INSERT INTO savings_movements (saving_id, user_id, type, amount, description) VALUES ($1, $2, 'deposit', $3, $4)`,
      [savingId, req.userId, amount, txDescription]
    );

    // Create expense transaction (money leaving wallet into savings)
    await client.query(
      `INSERT INTO transactions (description, amount, type, user_id, date) VALUES ($1, $2, 'expense', $3, CURRENT_DATE)`,
      [txDescription, amount, req.userId]
    );

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM savings WHERE id = $1', [savingId]);
    const row = updated.rows[0];
    res.json({
      ...row,
      current_amount: parseFloat(row.current_amount),
      target_amount: row.target_amount ? parseFloat(row.target_amount) : null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Erro ao depositar' });
  } finally {
    client.release();
  }
});

// Withdraw from saving
router.post('/:id/withdraw', [
  body('amount').isFloat({ gt: 0 }).withMessage('Valor deve ser maior que zero'),
  body('description').optional().trim().isLength({ max: 100 }),
], validate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { amount, description } = req.body;
    const savingId = req.params.id;

    const saving = await client.query('SELECT * FROM savings WHERE id = $1 AND user_id = $2', [savingId, req.userId]);
    if (saving.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Economia não encontrada' });
    }

    const currentAmount = parseFloat(saving.rows[0].current_amount);
    if (amount > currentAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Saldo insuficiente na economia' });
    }

    // Update saving
    await client.query(
      'UPDATE savings SET current_amount = current_amount - $1 WHERE id = $2',
      [amount, savingId]
    );

    const txDescription = description || `Retirada de ${saving.rows[0].name}`;

    // Record movement
    await client.query(
      `INSERT INTO savings_movements (saving_id, user_id, type, amount, description) VALUES ($1, $2, 'withdraw', $3, $4)`,
      [savingId, req.userId, amount, txDescription]
    );

    // Create income transaction (money returning from savings to wallet)
    await client.query(
      `INSERT INTO transactions (description, amount, type, user_id, date) VALUES ($1, $2, 'income', $3, CURRENT_DATE)`,
      [txDescription, amount, req.userId]
    );

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM savings WHERE id = $1', [savingId]);
    const row = updated.rows[0];
    res.json({
      ...row,
      current_amount: parseFloat(row.current_amount),
      target_amount: row.target_amount ? parseFloat(row.target_amount) : null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Erro ao retirar' });
  } finally {
    client.release();
  }
});

// Get movements for a saving
router.get('/:id/movements', async (req, res) => {
  try {
    const saving = await pool.query('SELECT id FROM savings WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (saving.rows.length === 0) return res.status(404).json({ message: 'Economia não encontrada' });

    const result = await pool.query(
      'SELECT * FROM savings_movements WHERE saving_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    res.json(result.rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar movimentações' });
  }
});

// Delete saving
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM savings WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Economia não encontrada' });
    res.json({ message: 'Economia excluída' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao excluir economia' });
  }
});

// Summary (total saved across all savings)
router.get('/summary/total', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COALESCE(SUM(current_amount), 0) as total_saved, COUNT(*) as count FROM savings WHERE user_id = $1',
      [req.userId]
    );
    res.json({
      totalSaved: parseFloat(result.rows[0].total_saved),
      count: parseInt(result.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar resumo' });
  }
});

module.exports = router;
