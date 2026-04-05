require('dotenv').config();
const express = require('express');

// Validate required env vars at startup
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS - allow multiple trusted origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://bloom-finance-50.lovable.app',
  'https://evolution-bloom-frontend.exf0ty.easypanel.host',
];
if (process.env.FRONTEND_URL) {
  const extra = process.env.FRONTEND_URL.split(',').map(s => s.trim()).filter(Boolean);
  extra.forEach(o => { if (!allowedOrigins.includes(o)) allowedOrigins.push(o); });
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { message: 'Muitas tentativas. Tente novamente em 15 minutos.' },
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

// Health check (includes DB connectivity test)
app.get('/api/health', async (req, res) => {
  try {
    const { pool } = require('./db/connection');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
