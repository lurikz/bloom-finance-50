const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db/connection');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// ============ Admin: Send notification ============
router.post('/', authenticate, requireAdmin, [
  body('title').trim().notEmpty().withMessage('Título é obrigatório').isLength({ max: 200 }),
  body('message').trim().notEmpty().withMessage('Mensagem é obrigatória').isLength({ max: 2000 }),
  body('type').isIn(['income', 'expense', 'reminder', 'alert', 'system']).withMessage('Tipo inválido'),
  body('target').isIn(['all', 'user']).withMessage('Destino inválido'),
  body('target_user_id').optional({ nullable: true }).isUUID(),
], validate, async (req, res) => {
  try {
    const { title, message, type, target, target_user_id } = req.body;
    if (target === 'user' && !target_user_id) {
      return res.status(400).json({ message: 'Selecione um usuário para envio individual' });
    }
    const result = await pool.query(
      `INSERT INTO notifications (title, message, type, target, target_user_id, sent_by)
       VALUES ($1, $2, $3, $4, $5, 'admin') RETURNING *`,
      [title, message, type, target, target === 'user' ? target_user_id : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Send notification error:', err);
    res.status(500).json({ message: 'Erro ao enviar notificação' });
  }
});

// ============ Admin: List sent notifications (history) ============
router.get('/history', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, u.name as target_user_name, u.email as target_user_email,
        (SELECT COUNT(*) FROM notification_reads nr WHERE nr.notification_id = n.id) as read_count,
        CASE 
          WHEN n.target = 'all' THEN (SELECT COUNT(*) FROM users)
          ELSE 1 
        END as total_recipients
      FROM notifications n
      LEFT JOIN users u ON u.id = n.target_user_id
      ORDER BY n.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Notification history error:', err);
    res.status(500).json({ message: 'Erro ao listar histórico' });
  }
});

// ============ Admin: Delete notification ============
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Notificação não encontrada' });
    res.json({ message: 'Notificação excluída' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ message: 'Erro ao excluir notificação' });
  }
});

// ============ User: Get my notifications ============
router.get('/mine', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.id, n.title, n.message, n.type, n.created_at,
        CASE WHEN nr.id IS NOT NULL THEN true ELSE false END as read
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $1
      WHERE n.target = 'all' OR (n.target = 'user' AND n.target_user_id = $1)
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: 'Erro ao buscar notificações' });
  }
});

// ============ User: Mark as read ============
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO notification_reads (notification_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ message: 'Erro ao marcar como lida' });
  }
});

// ============ User: Mark all as read ============
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO notification_reads (notification_id, user_id)
      SELECT n.id, $1 FROM notifications n
      WHERE (n.target = 'all' OR (n.target = 'user' AND n.target_user_id = $1))
        AND NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.user_id = $1)
    `, [req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ message: 'Erro ao marcar todas como lidas' });
  }
});

module.exports = router;
