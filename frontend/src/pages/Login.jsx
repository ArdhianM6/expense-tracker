import { useState } from 'react';
import api from '../api/axios';

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await api.post('/auth/register', { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
        setIsRegister(false);
        setForm({ name: '', email: '', password: '' });
        setError('Akun berhasil dibuat. Silakan login dengan email dan password baru.');
      } else {
        const res = await api.post('/auth/login', { email: form.email.trim().toLowerCase(), password: form.password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onLogin(res.data.user);
      }
    } catch (err) {
      const status = err.response?.status;
      setError(
        err.response?.data?.error ||
        (status === 429
          ? 'Terlalu banyak percobaan. Tunggu 15 menit sebelum mencoba lagi.'
          : err.response
            ? 'Login gagal. Periksa kembali email dan password.'
            : 'Tidak dapat terhubung ke server. Pastikan backend dan database berjalan.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>💰 Expense Tracker</h1>
        <h2>{isRegister ? 'Daftar Akun' : 'Login'}</h2>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <input
              type="text"
              name="name"
              placeholder="Nama lengkap"
              value={form.name}
              onChange={handleChange}
              required
            />
          )}
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />
          {error && <p className={error.startsWith('Akun berhasil') ? 'success-msg' : 'error-msg'}>{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Memproses...' : isRegister ? 'Daftar' : 'Login'}
          </button>
        </form>
        <p className="switch-mode">
          {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <span onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? 'Login di sini' : 'Daftar di sini'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;
