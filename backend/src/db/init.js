require('dotenv').config();
const { pool } = require('./connection');

const defaults = [
  ['Salário', 'income'], ['Freelance', 'income'], ['Investimentos', 'income'], ['Outros', 'income'],
  ['Alimentação', 'expense'], ['Transporte', 'expense'], ['Moradia', 'expense'], ['Saúde', 'expense'],
  ['Educação', 'expense'], ['Lazer', 'expense'], ['Vestuário', 'expense'], ['Outros', 'expense'],
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
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        is_default BOOLEAN DEFAULT FALSE,
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
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(7);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_default_unique ON categories (name, type) WHERE user_id IS NULL AND is_default = TRUE;

      CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_fixed_expense ON transactions(fixed_expense_id);
    `);

    // Remove duplicate default categories (keep only the oldest one per name+type)
    await client.query(`
      DELETE FROM categories
      WHERE is_default = TRUE AND user_id IS NULL
        AND id NOT IN (
          SELECT MIN(id) FROM categories WHERE is_default = TRUE AND user_id IS NULL GROUP BY name, type
        )
    `);

    for (const [name, type] of defaults) {
      await client.query(
        `INSERT INTO categories (name, type, user_id, is_default) VALUES ($1, $2, NULL, TRUE) ON CONFLICT DO NOTHING`,
        [name, type]
      );
    }

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

module.exports = { ensureDatabaseInitialized };
