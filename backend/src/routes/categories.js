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

// List (user's + defaults)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM categories WHERE user_id = $1 OR is_default = TRUE ORDER BY type, name`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar categorias' });
  }
});

// Create
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório').isLength({ max: 50 }),
  body('type').isIn(['income', 'expense']).withMessage('Tipo inválido'),
], validate, async (req, res) => {
  try {
    const { name, type } = req.body;
    const result = await pool.query(
      `INSERT INTO categories (name, type, user_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, type, req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Categoria já existe' });
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar categoria' });
  }
});

// Delete (only user-owned, not defaults)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2 AND is_default = FALSE RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Categoria não encontrada ou é padrão' });
    res.json({ message: 'Excluída' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao excluir categoria' });
  }
});

module.exports = router;
