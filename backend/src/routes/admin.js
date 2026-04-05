const express = require('express');
const { authenticate } = require('../middleware/auth');
const { ensureDatabaseInitialized, syncDefaultCategoriesForAllUsers } = require('../db/init');
const { pool } = require('../db/connection');

const router = express.Router();
router.use(authenticate);

// Initialize/update database schema
router.post('/init-db', async (req, res) => {
  try {
    await ensureDatabaseInitialized();
    res.json({ success: true, message: 'Schema do banco atualizado com sucesso!' });
  } catch (err) {
    console.error('Admin init-db error:', err);
    res.status(500).json({ success: false, message: 'Erro ao inicializar banco de dados' });
  }
});

// Sync default categories for all existing users
router.post('/sync-categories', async (req, res) => {
  try {
    const result = await syncDefaultCategoriesForAllUsers();
    res.json({ success: true, message: `Categorias sincronizadas para ${result.synced} de ${result.total} usuários` });
  } catch (err) {
    console.error('Admin sync-categories error:', err);
    res.status(500).json({ success: false, message: 'Erro ao sincronizar categorias' });
  }
});

// Check database status
router.get('/db-status', async (req, res) => {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    const counts = {};
    for (const row of tables.rows) {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
      counts[row.table_name] = parseInt(countResult.rows[0].count);
    }

    const colCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
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

module.exports = router;
