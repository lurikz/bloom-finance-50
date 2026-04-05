const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db/connection');
const { ADMIN_EMAIL } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    const user = result.rows[0];
    res.json({ ...user, is_admin: user.email === ADMIN_EMAIL });
  } catch (err) {
    console.error('Profile get error:', err);
    res.status(500).json({ message: 'Erro ao carregar perfil' });
  }
});

// Update name
router.put('/name', [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório').isLength({ max: 100 }).withMessage('Nome muito longo'),
], validate, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email',
      [req.body.name, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    const user = result.rows[0];
    res.json({ ...user, is_admin: user.email === ADMIN_EMAIL });
  } catch (err) {
    console.error('Profile name error:', err);
    res.status(500).json({ message: 'Erro ao atualizar nome' });
  }
});

// Update email
router.put('/email', [
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
  body('current_password').notEmpty().withMessage('Senha atual é obrigatória'),
], validate, async (req, res) => {
  try {
    const { email, current_password } = req.body;

    // Verify current password
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    const valid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Senha atual incorreta' });

    // Check duplicate
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.userId]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email já cadastrado por outro usuário' });

    const result = await pool.query(
      'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, name, email',
      [email, req.userId]
    );
    const user = result.rows[0];
    res.json({ ...user, is_admin: user.email === ADMIN_EMAIL });
  } catch (err) {
    console.error('Profile email error:', err);
    res.status(500).json({ message: 'Erro ao atualizar email' });
  }
});

// Update password
router.put('/password', [
  body('current_password').notEmpty().withMessage('Senha atual é obrigatória'),
  body('new_password').isLength({ min: 6 }).withMessage('Nova senha deve ter no mínimo 6 caracteres'),
], validate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    const valid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.userId]);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error('Profile password error:', err);
    res.status(500).json({ message: 'Erro ao alterar senha' });
  }
});

module.exports = router;
