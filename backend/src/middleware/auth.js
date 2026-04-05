const jwt = require('jsonwebtoken');
const { pool } = require('../db/connection');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'padilha.ctt@gmail.com';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0 || result.rows[0].email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Acesso restrito ao administrador' });
    }
    next();
  } catch (err) {
    console.error('Admin check error:', err);
    return res.status(500).json({ message: 'Erro ao verificar permissão' });
  }
}

module.exports = { authenticate, requireAdmin, ADMIN_EMAIL };
