const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// ==================== SECURITY ====================
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Terlalu banyak request, coba lagi 15 menit lagi' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak percobaan login, coba lagi 15 menit lagi' }
});

app.use(limiter);

app.use(cors({
  origin: function (origin, callback) {
    if (
      !origin ||
      origin.includes('vercel.app') ||
      origin.includes('localhost')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// ==================== DATABASE ====================
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

// ==================== MIDDLEWARE JWT ====================
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Akses ditolak' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid' });
  }
};

// ==================== AUTH ====================

// Register
app.post('/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  // Validasi input
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }
  if (name.trim().length < 2) {
    return res.status(400).json({ error: 'Nama minimal 2 karakter' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Format email tidak valid' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name.trim(), email.toLowerCase().trim(), hashed]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Email sudah digunakan' });
    } else {
      res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
  }
});

// Login
app.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  // Validasi input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Email atau password salah' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Email atau password salah' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Update profile
app.put('/auth/profile', authenticate, async (req, res) => {
  const { name, currentPassword, newPassword } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Nama minimal 2 karakter' });
  }
  if (newPassword && newPassword.length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (newPassword) {
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ error: 'Password lama salah' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET name=$1, password=$2 WHERE id=$3',
        [name.trim(), hashed, req.userId]
      );
    } else {
      await pool.query(
        'UPDATE users SET name=$1 WHERE id=$2',
        [name.trim(), req.userId]
      );
    }

    const updated = await pool.query(
      'SELECT id, name, email FROM users WHERE id=$1',
      [req.userId]
    );
    res.json(updated.rows[0]);
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// ==================== TRANSACTIONS ====================

// Ambil semua transaksi
app.get('/transactions', authenticate, async (req, res) => {
  const { month, year, category, type } = req.query;
  try {
    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    const params = [req.userId];

    if (month && year) {
      params.push(month, year);
      query += ` AND EXTRACT(MONTH FROM date) = $${params.length - 1} AND EXTRACT(YEAR FROM date) = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    query += ' ORDER BY date DESC, created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Tambah transaksi
app.post('/transactions', authenticate, async (req, res) => {
  const { type, amount, category, description, date } = req.body;

  if (!type || !amount || !date) {
    return res.status(400).json({ error: 'Tipe, jumlah, dan tanggal wajib diisi' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'Tipe harus income atau expense' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Jumlah harus angka positif' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.userId, type, amount, category, description, date]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Edit transaksi
app.put('/transactions/:id', authenticate, async (req, res) => {
  const { type, amount, category, description, date } = req.body;

  if (!type || !amount || !date) {
    return res.status(400).json({ error: 'Tipe, jumlah, dan tanggal wajib diisi' });
  }

  try {
    const result = await pool.query(
      'UPDATE transactions SET type=$1, amount=$2, category=$3, description=$4, date=$5 WHERE id=$6 AND user_id=$7 RETURNING *',
      [type, amount, category, description, date, req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Hapus transaksi
app.delete('/transactions/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    res.json({ message: 'Transaksi dihapus' });
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Ringkasan per bulan
app.get('/transactions/summary', authenticate, async (req, res) => {
  const { month, year } = req.query;
  try {
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type='income' THEN amount END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0) AS total_expense
       FROM transactions 
       WHERE user_id=$1 
         AND EXTRACT(MONTH FROM date)=$2 
         AND EXTRACT(YEAR FROM date)=$3`,
      [req.userId, month, year]
    );
    const { total_income, total_expense } = result.rows[0];
    res.json({
      income: parseFloat(total_income),
      expense: parseFloat(total_expense),
      balance: parseFloat(total_income) - parseFloat(total_expense),
    });
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Ringkasan tahunan
app.get('/transactions/annual', authenticate, async (req, res) => {
  const { year } = req.query;
  try {
    const result = await pool.query(
      `SELECT 
        EXTRACT(MONTH FROM date) AS month,
        COALESCE(SUM(CASE WHEN type='income' THEN amount END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0) AS expense
       FROM transactions
       WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2
       GROUP BY EXTRACT(MONTH FROM date)
       ORDER BY month`,
      [req.userId, year]
    );

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const found = result.rows.find((r) => parseInt(r.month) === i + 1);
      return {
        month: i + 1,
        income: parseFloat(found?.income || 0),
        expense: parseFloat(found?.expense || 0),
        balance: parseFloat(found?.income || 0) - parseFloat(found?.expense || 0),
      };
    });

    const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
    const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);

    res.json({ monthly, totalIncome, totalExpense, totalBalance: totalIncome - totalExpense });
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// ==================== BUDGETS ====================

app.get('/budgets', authenticate, async (req, res) => {
  const { month, year } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM budgets WHERE user_id=$1 AND month=$2 AND year=$3',
      [req.userId, month, year]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.post('/budgets', authenticate, async (req, res) => {
  const { category, amount, month, year } = req.body;

  if (!category || !amount || !month || !year) {
    return res.status(400).json({ error: 'Semua field budget wajib diisi' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO budgets (user_id, category, amount, month, year)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, category, month, year)
       DO UPDATE SET amount = EXCLUDED.amount
       RETURNING *`,
      [req.userId, category, amount, month, year]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server jalan di http://localhost:${PORT}`));