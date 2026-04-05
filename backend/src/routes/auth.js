const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/connection');
const { createDefaultCategoriesForUser } = require('../db/init');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

// Register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
], validate, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hash]
    );
    const user = result.rows[0];

    // Create default categories for the new user
    await createDefaultCategoriesForUser(user.id);

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    if (process.env.NODE_ENV !== 'production') {
      const detail = err.code === 'ECONNREFUSED' ? 'Banco de dados não acessível'
        : err.code === '42P01' ? 'Tabela users não existe. Execute o script init.sql'
        : err.code === '28P01' ? 'Credenciais do banco inválidas'
        : err.message || 'Erro desconhecido';
      return res.status(500).json({ message: 'Erro ao criar conta', detail });
    }
    res.status(500).json({ message: 'Erro ao criar conta' });
  }
});

// Login
router.post('/login', [
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
], validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email ou senha incorretos' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Email ou senha incorretos' });
    }

    // Ensure user has default categories (for users created before this feature)
    const catCount = await pool.query('SELECT COUNT(*) FROM categories WHERE user_id = $1', [user.id]);
    if (parseInt(catCount.rows[0].count) === 0) {
      await createDefaultCategoriesForUser(user.id);
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao fazer login' });
  }
});

// Forgot password
router.post('/forgot-password', [
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
], validate, async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const resetToken = jwt.sign({ userId: result.rows[0].id, type: 'reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      console.log(`Password reset token for ${email}: ${resetToken}`);
    }
    res.json({ message: 'Se o email existir, um link será enviado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao processar solicitação' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token é obrigatório'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
], validate, async (req, res) => {
  try {
    const { token, password } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'reset') {
      return res.status(400).json({ message: 'Token inválido' });
    }
    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, decoded.userId]);
    res.json({ message: 'Senha redefinida com sucesso' });
  } catch {
    res.status(400).json({ message: 'Token inválido ou expirado' });
  }
});

module.exports = router;
