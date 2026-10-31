const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
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
  skipSuccessfulRequests: true,
  message: { error: 'Terlalu banyak percobaan login, coba lagi 15 menit lagi' }
});

app.use(limiter);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    let host = '';
    try { host = new URL(origin).hostname; } catch { return callback(new Error('Origin tidak valid')); }
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// ==================== DATABASE ====================
const pool = new Pool({
  ...(process.env.DATABASE_URL
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
      }),
  // Detect unreachable databases quickly and let pg discard broken idle sockets.
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Without this listener, an error on an idle pooled connection can crash Node.
pool.on('error', (error) => {
  console.error('Koneksi database idle terputus; koneksi akan dibuat ulang saat diperlukan:', error.message);
});

// Ensure a fresh database is ready before the API accepts requests.
const initializeDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id, expires_at DESC);
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (organization_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
      amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
      category VARCHAR(100),
      description TEXT,
      date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, date DESC);
    CREATE TABLE IF NOT EXISTS budgets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category VARCHAR(100) NOT NULL,
      amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      year INTEGER NOT NULL,
      UNIQUE (user_id, category, month, year)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(30) NOT NULL,
      entity VARCHAR(30) NOT NULL,
      entity_id INTEGER,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx ON audit_logs(user_id, created_at DESC);
  `);

  await pool.query(`
    WITH new_organizations AS (
      INSERT INTO organizations (name, created_by)
      SELECT CONCAT(name, ' - Tim Keuangan'), id FROM users u
      WHERE NOT EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id=u.id)
      RETURNING id, created_by
    )
    INSERT INTO organization_members (organization_id, user_id, role)
    SELECT id, created_by, 'admin' FROM new_organizations
  `);

  await pool.query(`
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    UPDATE transactions t SET organization_id=m.organization_id FROM organization_members m WHERE t.user_id=m.user_id AND t.organization_id IS NULL;
    UPDATE budgets b SET organization_id=m.organization_id FROM organization_members m WHERE b.user_id=m.user_id AND b.organization_id IS NULL;
    UPDATE audit_logs a SET organization_id=m.organization_id FROM organization_members m WHERE a.user_id=m.user_id AND a.organization_id IS NULL;
    ALTER TABLE transactions ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE budgets ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE audit_logs ALTER COLUMN organization_id SET NOT NULL;
    DO $migration$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transactions_organization_id_fkey') THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budgets_organization_id_fkey') THEN
        ALTER TABLE budgets ADD CONSTRAINT budgets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_logs_organization_id_fkey') THEN
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END
    $migration$;
    ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_month_year_key;
    CREATE UNIQUE INDEX IF NOT EXISTS budgets_org_category_month_year_uidx ON budgets(organization_id, category, month, year);
    CREATE INDEX IF NOT EXISTS transactions_org_date_idx ON transactions(organization_id, date DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON audit_logs(organization_id, created_at DESC);
  `);
  await pool.query("DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '30 days'");
};

const writeAuditLog = (organizationId, userId, action, entity, entityId, details = {}, executor = pool) =>
  executor.query(
    'INSERT INTO audit_logs (organization_id, user_id, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
    [organizationId, userId, action, entity, entityId || null, JSON.stringify(details)]
  );

const runAuditedChange = async (req, action, entity, details, change) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await change(client);
    const record = result.rows?.[0];
    if (record) {
      await writeAuditLog(req.orgId, req.userId, action, entity, record.id, details(record), client);
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ==================== MIDDLEWARE JWT ====================
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Akses ditolak' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.authSessionId = decoded.jti || null;
    if (req.authSessionId) {
      const session = await pool.query(
        'SELECT 1 FROM auth_sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at > NOW()',
        [req.authSessionId, req.userId]
      );
      if (!session.rows[0]) return res.status(401).json({ error: 'Sesi sudah berakhir. Silakan masuk kembali.' });
    }
    const membership = await pool.query(
      `SELECT m.organization_id, m.role, o.name AS organization_name
       FROM organization_members m JOIN organizations o ON o.id=m.organization_id
       WHERE m.user_id=$1 AND ($2::integer IS NULL OR m.organization_id=$2)
       ORDER BY m.created_at LIMIT 1`,
      [req.userId, decoded.orgId || null]
    );
    if (!membership.rows[0]) return res.status(403).json({ error: 'Akses workspace tidak tersedia' });
    req.orgId = membership.rows[0].organization_id;
    req.role = membership.rows[0].role;
    req.organizationName = membership.rows[0].organization_name;
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid' });
  }
};

const createSessionToken = async (userId, organizationId) => {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [sessionId, userId, expiresAt]);
  return jwt.sign({ userId, orgId: organizationId, jti: sessionId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
    if (!result.rows[0]) return res.status(401).json({ error: 'Akun tidak ditemukan' });
    res.json({ ...result.rows[0], orgId: req.orgId, organizationName: req.organizationName, role: req.role });
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

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

  const client = await pool.connect();
  try {
    const hashed = await bcrypt.hash(password, 10);
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name.trim(), email.toLowerCase().trim(), hashed]
    );
    const organization = await client.query(
      'INSERT INTO organizations (name, created_by) VALUES ($1, $2) RETURNING id, name',
      [`${name.trim()} - Tim Keuangan`, result.rows[0].id]
    );
    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'admin')",
      [organization.rows[0].id, result.rows[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...result.rows[0], orgId: organization.rows[0].id, organizationName: organization.rows[0].name, role: 'admin' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      res.status(400).json({ error: 'Email sudah digunakan' });
    } else {
      console.error('Gagal mendaftarkan akun:', err.code, err.message);
      res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
  } finally {
    client.release();
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
    const result = await pool.query(
      `SELECT u.*, m.organization_id, m.role, o.name AS organization_name
       FROM users u JOIN organization_members m ON m.user_id=u.id
       JOIN organizations o ON o.id=m.organization_id
       WHERE u.email=$1 ORDER BY m.created_at LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Email atau password salah' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Email atau password salah' });

    const token = await createSessionToken(user.id, user.organization_id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, orgId: user.organization_id, organizationName: user.organization_name, role: user.role } });
  } catch (error) {
    console.error('Gagal login:', error.code || 'UNKNOWN', error.message);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.post('/auth/logout', authenticate, async (req, res) => {
  try {
    if (req.authSessionId) {
      await pool.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL', [req.authSessionId, req.userId]);
    }
    res.json({ message: 'Sesi telah diakhiri' });
  } catch {
    res.status(500).json({ error: 'Sesi gagal diakhiri di server' });
  }
});

app.get('/organizations', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.name, m.role
       FROM organization_members m JOIN organizations o ON o.id=m.organization_id
       WHERE m.user_id=$1 ORDER BY o.name`,
      [req.userId]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Gagal memuat workspace' });
  }
});

app.post('/organizations/:id/switch', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.name, m.role FROM organization_members m
       JOIN organizations o ON o.id=m.organization_id
       WHERE m.user_id=$1 AND m.organization_id=$2`,
      [req.userId, req.params.id]
    );
    const organization = result.rows[0];
    if (!organization) return res.status(403).json({ error: 'Anda bukan anggota workspace ini' });
    const token = await createSessionToken(req.userId, organization.id);
    res.json({ token, organization });
  } catch {
    res.status(500).json({ error: 'Gagal mengganti workspace' });
  }
});

app.post('/organizations/:id/members', authenticate, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (req.role !== 'admin') return res.status(403).json({ error: 'Hanya admin workspace yang dapat menambahkan anggota' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Format email tidak valid' });
  if (Number(req.params.id) !== Number(req.orgId)) return res.status(403).json({ error: 'Akses workspace tidak tersedia' });
  try {
    const user = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (!user.rows[0]) return res.status(404).json({ error: 'Akun belum terdaftar. Minta anggota membuat akun terlebih dahulu.' });
    const result = await runAuditedChange(req, 'added', 'member', () => ({ email }), (client) =>
      client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'member') ON CONFLICT (organization_id, user_id) DO NOTHING
         RETURNING user_id AS id`,
        [req.orgId, user.rows[0].id]
      )
    );
    res.status(result.rows[0] ? 201 : 200).json({ message: result.rows[0] ? 'Anggota ditambahkan' : 'Akun tersebut sudah menjadi anggota' });
  } catch (error) {
    console.error('Gagal menambahkan anggota:', error.code, error.message);
    res.status(500).json({ error: 'Gagal menambahkan anggota' });
  }
});

app.get('/organizations/:id/members', authenticate, async (req, res) => {
  if (Number(req.params.id) !== Number(req.orgId)) return res.status(403).json({ error: 'Akses workspace tidak tersedia' });
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, m.role
       FROM organization_members m JOIN users u ON u.id=m.user_id
       WHERE m.organization_id=$1 ORDER BY CASE WHEN m.role='admin' THEN 0 ELSE 1 END, u.name`,
      [req.orgId]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Gagal memuat anggota' });
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
      if (req.authSessionId) {
        await pool.query(
          'UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL',
          [req.userId, req.authSessionId]
        );
      }
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
    let query = 'SELECT * FROM transactions WHERE organization_id = $1';
    const params = [req.orgId];

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

app.get('/audit-logs', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.created_at, u.name AS actor_name
       FROM audit_logs a JOIN users u ON u.id=a.user_id
       WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 100`,
      [req.orgId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Gagal memuat audit log:', error.code, error.message);
    res.status(500).json({ error: 'Gagal memuat riwayat aktivitas' });
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
    const result = await runAuditedChange(req, 'created', 'transaction', () => ({
      type, amount, category, date,
    }), (client) => client.query(
      'INSERT INTO transactions (user_id, organization_id, type, amount, category, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.userId, req.orgId, type, amount, category, description, date]
    )
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Gagal menyimpan transaksi:', error.code, error.message);
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
    const result = await runAuditedChange(req, 'updated', 'transaction', () => ({
      type, amount, category, date,
    }), (client) => client.query(
      `UPDATE transactions SET type=$1, amount=$2, category=$3, description=$4, date=$5
       WHERE id=$6 AND organization_id=$7 AND ($8::boolean OR user_id=$9) RETURNING *`,
      [type, amount, category, description, date, req.params.id, req.orgId, req.role === 'admin', req.userId]
    ));
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Gagal memperbarui transaksi:', error.code, error.message);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Hapus transaksi
app.delete('/transactions/:id', authenticate, async (req, res) => {
  try {
    const result = await runAuditedChange(req, 'deleted', 'transaction', (record) => record, (client) => client.query(
      `DELETE FROM transactions WHERE id=$1 AND organization_id=$2
       AND ($3::boolean OR user_id=$4) RETURNING id, type, amount, category`,
      [req.params.id, req.orgId, req.role === 'admin', req.userId]
    ));
    if (!result.rows[0]) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    res.json({ message: 'Transaksi dihapus' });
  } catch (error) {
    console.error('Gagal menghapus transaksi:', error.code, error.message);
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
       WHERE organization_id=$1
         AND EXTRACT(MONTH FROM date)=$2 
         AND EXTRACT(YEAR FROM date)=$3`,
      [req.orgId, month, year]
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
       WHERE organization_id = $1 AND EXTRACT(YEAR FROM date) = $2
       GROUP BY EXTRACT(MONTH FROM date)
       ORDER BY month`,
      [req.orgId, year]
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
      'SELECT * FROM budgets WHERE organization_id=$1 AND month=$2 AND year=$3',
      [req.orgId, month, year]
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
  if (req.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang dapat mengelola anggaran' });

  try {
    const result = await runAuditedChange(req, 'saved', 'budget', () => ({
      category, amount, month, year,
    }), (client) => client.query(
      `INSERT INTO budgets (user_id, organization_id, category, amount, month, year)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id, category, month, year)
       DO UPDATE SET amount = EXCLUDED.amount
       RETURNING *`,
      [req.userId, req.orgId, category, amount, month, year]
    ));
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

app.delete('/budgets/:category', authenticate, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'Bulan dan tahun wajib diisi' });
  if (req.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang dapat mengelola anggaran' });
  try {
    const result = await runAuditedChange(req, 'deleted', 'budget', () => ({
      category: req.params.category, month, year,
    }), (client) => client.query(
      'DELETE FROM budgets WHERE organization_id=$1 AND category=$2 AND month=$3 AND year=$4 RETURNING id',
      [req.orgId, req.params.category, month, year]
    ));
    res.json({ message: 'Budget dihapus' });
  } catch {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

const PORT = process.env.PORT || 5000;
initializeDatabase()
  .then(() => app.listen(PORT, () => console.log(`Server jalan di http://localhost:${PORT}`)))
  .catch((error) => {
    console.error('Database tidak siap; server tidak dijalankan.', error.message);
    process.exit(1);
  });
