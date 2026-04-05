const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { ensureDatabaseInitialized, syncDefaultCategoriesForAllUsers } = require('../db/init');
const { pool } = require('../db/connection');

const router = express.Router();
router.use(authenticate);
router.use(requireAdmin);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// ============ Database Management ============

router.post('/init-db', async (req, res) => {
  try {
    await ensureDatabaseInitialized();
    res.json({ success: true, message: 'Schema do banco atualizado com sucesso!' });
  } catch (err) {
    console.error('Admin init-db error:', err);
    res.status(500).json({ success: false, message: 'Erro ao inicializar banco de dados' });
  }
});

router.post('/sync-categories', async (req, res) => {
  try {
    const result = await syncDefaultCategoriesForAllUsers();
    res.json({ success: true, message: `Categorias sincronizadas para ${result.synced} de ${result.total} usuários` });
  } catch (err) {
    console.error('Admin sync-categories error:', err);
    res.status(500).json({ success: false, message: 'Erro ao sincronizar categorias' });
  }
});

router.get('/db-status', async (req, res) => {
  try {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    const counts = {};
    for (const row of tables.rows) {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
      counts[row.table_name] = parseInt(countResult.rows[0].count);
    }
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'fixed_expense_id'
    `);
    res.json({
      success: true,
      tables: tables.rows.map(r => r.table_name),
      counts,
      hasFixedExpenseColumn: colCheck.rows.length > 0,
    });
  } catch (err) {
    console.error('Admin db-status error:', err);
    res.status(500).json({ success: false, message: 'Erro ao verificar status do banco' });
  }
});

// ============ User Management ============

router.get('/users', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.is_blocked, u.created_at,
        u.client_type, u.plan_amount, u.due_day,
        s.id as sub_id, s.amount as sub_amount, s.due_date as sub_due_date, 
        s.status as sub_status, s.paid_at as sub_paid_at
      FROM users u
      LEFT JOIN LATERAL (
        SELECT * FROM subscriptions WHERE user_id = u.id ORDER BY due_date DESC LIMIT 1
      ) s ON true
    `;
    const conditions = [];
    const params = [];

    if (status === 'blocked') {
      conditions.push('u.is_blocked = true');
    } else if (status === 'active') {
      conditions.push('u.is_blocked = false');
    } else if (status === 'overdue') {
      conditions.push("s.status = 'overdue'");
    } else if (status === 'due_soon') {
      conditions.push("s.status = 'pending' AND s.due_date <= CURRENT_DATE + INTERVAL '7 days'");
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY u.created_at DESC';

    const result = await pool.query(query, params);
    const users = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      is_blocked: r.is_blocked,
      created_at: r.created_at,
      client_type: r.client_type || 'recurring',
      plan_amount: r.plan_amount ? parseFloat(r.plan_amount) : null,
      due_day: r.due_day,
      latest_subscription: r.sub_id ? {
        id: r.sub_id,
        amount: parseFloat(r.sub_amount),
        due_date: r.sub_due_date,
        status: r.sub_status,
        paid_at: r.sub_paid_at,
      } : null,
    }));
    res.json(users);
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
});

router.post('/users', [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
  body('client_type').optional().isIn(['recurring', 'lifetime']),
  body('plan_amount').optional().isFloat({ min: 0.01 }),
  body('due_day').optional().isInt({ min: 1, max: 31 }),
], validate, async (req, res) => {
  try {
    const { name, email, password, client_type = 'recurring', plan_amount, due_day } = req.body;
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email já cadastrado' });
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, client_type, plan_amount, due_day) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, email, is_blocked, created_at, client_type, plan_amount, due_day`,
      [name, email, hash, client_type, plan_amount || null, due_day || null]
    );
    const user = result.rows[0];

    // Auto-generate first subscription for recurring clients
    if (client_type === 'recurring' && plan_amount && due_day) {
      const now = new Date();
      const dueDate = new Date(now.getFullYear(), now.getMonth(), due_day);
      if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
      await pool.query(
        `INSERT INTO subscriptions (user_id, amount, due_date, status) VALUES ($1, $2, $3, 'pending')`,
        [user.id, plan_amount, dueDate.toISOString().split('T')[0]]
      );
    }

    res.status(201).json(user);
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ message: 'Erro ao criar usuário' });
  }
});

router.put('/users/:id', [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('client_type').optional().isIn(['recurring', 'lifetime']),
  body('plan_amount').optional().isFloat({ min: 0.01 }),
  body('due_day').optional().isInt({ min: 1, max: 31 }),
], validate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, client_type, plan_amount, due_day } = req.body;
    const sets = [];
    const params = [];
    let idx = 1;

    if (name) { sets.push(`name = $${idx++}`); params.push(name); }
    if (email) { sets.push(`email = $${idx++}`); params.push(email); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      sets.push(`password_hash = $${idx++}`);
      params.push(hash);
    }
    if (client_type) { sets.push(`client_type = $${idx++}`); params.push(client_type); }
    if (plan_amount !== undefined) { sets.push(`plan_amount = $${idx++}`); params.push(plan_amount); }
    if (due_day !== undefined) { sets.push(`due_day = $${idx++}`); params.push(due_day); }
    if (sets.length === 0) return res.status(400).json({ message: 'Nenhum dado para atualizar' });
    params.push(id);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, email, is_blocked, created_at, client_type, plan_amount, due_day`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ message: 'Erro ao atualizar usuário' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ message: 'Usuário excluído' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ message: 'Erro ao excluir usuário' });
  }
});

router.post('/users/:id/block', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_blocked = true WHERE id = $1 RETURNING id, name, email, is_blocked',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin block user error:', err);
    res.status(500).json({ message: 'Erro ao bloquear usuário' });
  }
});

router.post('/users/:id/unblock', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_blocked = false WHERE id = $1 RETURNING id, name, email, is_blocked',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin unblock user error:', err);
    res.status(500).json({ message: 'Erro ao desbloquear usuário' });
  }
});

// ============ Subscriptions ============

router.get('/subscriptions', async (req, res) => {
  try {
    const { user_id, status, month, year } = req.query;

    // Auto-update overdue before querying
    await pool.query(`UPDATE subscriptions SET status = 'overdue' WHERE status = 'pending' AND due_date < CURRENT_DATE`);

    let query = `
      SELECT s.*, u.name as user_name, u.email as user_email, u.client_type
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
    `;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (user_id) { conditions.push(`s.user_id = $${idx++}`); params.push(user_id); }
    if (status === 'lost') {
      conditions.push(`s.status = 'overdue' AND s.due_date < CURRENT_DATE - INTERVAL '30 days'`);
    } else if (status) {
      conditions.push(`s.status = $${idx++}`); params.push(status);
    }
    if (month && year) {
      conditions.push(`EXTRACT(MONTH FROM s.due_date) = $${idx++}`); params.push(parseInt(month, 10));
      conditions.push(`EXTRACT(YEAR FROM s.due_date) = $${idx++}`); params.push(parseInt(year, 10));
    } else if (year) {
      conditions.push(`EXTRACT(YEAR FROM s.due_date) = $${idx++}`); params.push(parseInt(year, 10));
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY s.due_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount),
      is_lost: r.status === 'overdue' && new Date(r.due_date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    })));
  } catch (err) {
    console.error('Admin subscriptions error:', err);
    res.status(500).json({ message: 'Erro ao listar cobranças' });
  }
});

router.post('/subscriptions', [
  body('user_id').isUUID().withMessage('user_id inválido'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valor inválido'),
  body('due_date').isISO8601().withMessage('Data de vencimento inválida'),
], validate, async (req, res) => {
  try {
    const { user_id, amount, due_date } = req.body;
    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, amount, due_date, status) 
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [user_id, amount, due_date]
    );
    res.status(201).json({ ...result.rows[0], amount: parseFloat(result.rows[0].amount) });
  } catch (err) {
    console.error('Admin create subscription error:', err);
    res.status(500).json({ message: 'Erro ao criar mensalidade' });
  }
});

// Helper: auto-generate next month's subscription for recurring clients
async function autoGenerateNextSubscription(sub) {
  // Check if user is recurring
  const userResult = await pool.query(
    `SELECT client_type, plan_amount, due_day FROM users WHERE id = $1`,
    [sub.user_id]
  );
  if (userResult.rows.length === 0) return null;
  const user = userResult.rows[0];
  if (user.client_type !== 'recurring') return null;

  const currentDue = new Date(sub.due_date);
  const nextDue = new Date(currentDue.getFullYear(), currentDue.getMonth() + 1, currentDue.getDate());
  const nextDueStr = nextDue.toISOString().split('T')[0];

  // Avoid duplicates
  const existing = await pool.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND due_date = $2`,
    [sub.user_id, nextDueStr]
  );
  if (existing.rows.length > 0) return null;

  const newSub = await pool.query(
    `INSERT INTO subscriptions (user_id, amount, due_date, status) VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [sub.user_id, sub.amount, nextDueStr]
  );
  return newSub.rows[0];
}

router.post('/subscriptions/:id/pay', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE subscriptions SET status = 'paid', paid_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Mensalidade não encontrada' });
    const sub = result.rows[0];

    // Auto-generate next month for recurring clients
    const nextSub = await autoGenerateNextSubscription(sub);

    res.json({
      ...sub,
      amount: parseFloat(sub.amount),
      next_subscription: nextSub ? { ...nextSub, amount: parseFloat(nextSub.amount) } : null,
    });
  } catch (err) {
    console.error('Admin pay subscription error:', err);
    res.status(500).json({ message: 'Erro ao registrar pagamento' });
  }
});

router.put('/subscriptions/:id/status', [
  body('status').isIn(['pending', 'paid', 'overdue']).withMessage('Status inválido'),
], validate, async (req, res) => {
  try {
    const { status } = req.body;
    const paid_at = status === 'paid' ? 'NOW()' : 'NULL';
    const result = await pool.query(
      `UPDATE subscriptions SET status = $1, paid_at = ${paid_at} WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Mensalidade não encontrada' });
    const sub = result.rows[0];

    // Auto-generate next month if marked as paid
    let nextSub = null;
    if (status === 'paid') {
      nextSub = await autoGenerateNextSubscription(sub);
    }

    res.json({
      ...sub,
      amount: parseFloat(sub.amount),
      next_subscription: nextSub ? { ...nextSub, amount: parseFloat(nextSub.amount) } : null,
    });
  } catch (err) {
    console.error('Admin update subscription status error:', err);
    res.status(500).json({ message: 'Erro ao atualizar status' });
  }
});

router.delete('/subscriptions/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM subscriptions WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Mensalidade não encontrada' });
    res.json({ message: 'Mensalidade excluída' });
  } catch (err) {
    console.error('Admin delete subscription error:', err);
    res.status(500).json({ message: 'Erro ao excluir mensalidade' });
  }
});

// Generate monthly subscriptions for all recurring users
router.post('/subscriptions/generate', async (req, res) => {
  try {
    const users = await pool.query(
      `SELECT id, plan_amount, due_day FROM users WHERE client_type = 'recurring' AND plan_amount IS NOT NULL AND due_day IS NOT NULL AND is_blocked = false`
    );
    let created = 0;
    const now = new Date();
    for (const u of users.rows) {
      const dueDate = new Date(now.getFullYear(), now.getMonth(), u.due_day);
      if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
      const dueDateStr = dueDate.toISOString().split('T')[0];
      // Check if subscription already exists for this month
      const existing = await pool.query(
        `SELECT id FROM subscriptions WHERE user_id = $1 AND due_date = $2`,
        [u.id, dueDateStr]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO subscriptions (user_id, amount, due_date, status) VALUES ($1, $2, $3, 'pending')`,
          [u.id, u.plan_amount, dueDateStr]
        );
        created++;
      }
    }
    res.json({ success: true, message: `${created} cobranças geradas para ${users.rows.length} clientes recorrentes` });
  } catch (err) {
    console.error('Admin generate subscriptions error:', err);
    res.status(500).json({ message: 'Erro ao gerar cobranças' });
  }
});

// ============ Admin Dashboard ============

router.get('/dashboard', async (req, res) => {
  try {
    const totalReceived = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM subscriptions WHERE status = 'paid'"
    );
    const totalOverdue = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM subscriptions WHERE status = 'overdue'"
    );
    const totalPending = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM subscriptions WHERE status = 'pending'"
    );
    const blockedLoss = await pool.query(
      `SELECT COALESCE(SUM(s.amount), 0) as total 
       FROM subscriptions s JOIN users u ON u.id = s.user_id 
       WHERE u.is_blocked = true AND s.status != 'paid'`
    );
    const totalUsers = await pool.query('SELECT COUNT(*) as count FROM users');
    const blockedUsers = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_blocked = true');
    const activeUsers = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_blocked = false');

    const statusBreakdown = await pool.query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM subscriptions GROUP BY status`
    );

    const monthlyRevenue = await pool.query(
      `SELECT DATE_TRUNC('month', paid_at) as month, SUM(amount) as total
       FROM subscriptions WHERE status = 'paid' AND paid_at IS NOT NULL
       GROUP BY DATE_TRUNC('month', paid_at)
       ORDER BY month DESC LIMIT 6`
    );

    res.json({
      totalReceived: parseFloat(totalReceived.rows[0].total),
      totalOverdue: parseFloat(totalOverdue.rows[0].total),
      totalPending: parseFloat(totalPending.rows[0].total),
      blockedLoss: parseFloat(blockedLoss.rows[0].total),
      totalUsers: parseInt(totalUsers.rows[0].count),
      blockedUsers: parseInt(blockedUsers.rows[0].count),
      activeUsers: parseInt(activeUsers.rows[0].count),
      statusBreakdown: statusBreakdown.rows.map(r => ({
        status: r.status,
        count: parseInt(r.count),
        total: parseFloat(r.total),
      })),
      monthlyRevenue: monthlyRevenue.rows.map(r => ({
        month: r.month,
        total: parseFloat(r.total),
      })),
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ message: 'Erro ao carregar dashboard' });
  }
});

module.exports = router;
