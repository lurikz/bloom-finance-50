require('dotenv').config();
const { pool } = require('./connection');

const DEFAULT_CATEGORIES = [
  ['Salário', 'income', '#10B981'],
  ['Freelance', 'income', '#3B82F6'],
  ['Saúde', 'expense', '#EF4444'],
  ['Transporte', 'expense', '#8B5CF6'],
  ['Aluguel', 'expense', '#F97316'],
  ['Água', 'expense', '#06B6D4'],
  ['Luz', 'expense', '#F59E0B'],
  ['Internet', 'expense', '#6366F1'],
  ['Cartão de crédito', 'expense', '#EC4899'],
];

async function ensureDatabaseInitialized() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_blocked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        color VARCHAR(7),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, type, user_id)
      );

      CREATE TABLE IF NOT EXISTS fixed_expenses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        description VARCHAR(100) NOT NULL,
        amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        recurrence_months INTEGER NOT NULL CHECK (recurrence_months >= 1 AND recurrence_months <= 120),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        description VARCHAR(100) NOT NULL,
        amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fixed_expense_id UUID REFERENCES fixed_expenses(id) ON DELETE SET NULL;

      -- Add is_blocked column if not exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

      -- Client type columns
      ALTER TABLE users ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) DEFAULT 'recurring' CHECK (client_type IN ('recurring', 'lifetime'));
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_amount DECIMAL(12,2);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31);

      -- Subscriptions table
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
        due_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_fixed_expense ON transactions(fixed_expense_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    `);

    // Drop is_default column if it exists (migration from old schema)
    await client.query(`ALTER TABLE categories DROP COLUMN IF EXISTS is_default`);
    await client.query(`DELETE FROM categories WHERE user_id IS NULL`);

    // Auto-mark overdue subscriptions
    await client.query(`
      UPDATE subscriptions SET status = 'overdue' 
      WHERE status = 'pending' AND due_date < CURRENT_DATE
    `);

    await client.query('COMMIT');
    console.log('Database schema is ready');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function createDefaultCategoriesForUser(userId) {
  const client = await pool.connect();
  try {
    for (const [name, type, color] of DEFAULT_CATEGORIES) {
      await client.query(
        `INSERT INTO categories (name, type, user_id, color) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [name, type, userId, color]
      );
    }
  } finally {
    client.release();
  }
}

async function syncDefaultCategoriesForAllUsers() {
  const client = await pool.connect();
  try {
    const users = await client.query('SELECT id FROM users');
    let synced = 0;
    for (const user of users.rows) {
      for (const [name, type, color] of DEFAULT_CATEGORIES) {
        await client.query(
          `INSERT INTO categories (name, type, user_id, color) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [name, type, user.id, color]
        );
      }
      synced++;
    }
    return { synced, total: users.rows.length };
  } finally {
    client.release();
  }
}

async function init() {
  try {
    await ensureDatabaseInitialized();
    console.log('Database initialized successfully!');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  init().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureDatabaseInitialized, createDefaultCategoriesForUser, syncDefaultCategoriesForAllUsers, DEFAULT_CATEGORIES };
