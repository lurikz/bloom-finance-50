const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/connection');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'padilha.ctt@gmail.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'lucaspadilha';
// Pre-hashed bcrypt of the admin password
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$12$M0Y9IXUr1jRWHRXdSxILY.aGUcUjOZi6TaoX8DKQ6nJWQej82a9L.';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.isAdminToken = decoded.isAdmin === true;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.isAdminToken) {
    return res.status(403).json({ message: 'Acesso restrito ao administrador' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD_HASH };
