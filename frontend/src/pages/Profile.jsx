import { useState } from 'react';
import api from '../api/axios';

function Profile({ user, onUpdate, onBack }) {
  const [form, setForm] = useState({
    name: user.name,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (changePassword) {
      if (!form.currentPassword) {
        return setError('Masukkan password lama');
      }
      if (form.newPassword.length < 6) {
        return setError('Password baru minimal 6 karakter');
      }
      if (form.newPassword !== form.confirmPassword) {
        return setError('Konfirmasi password tidak cocok');
      }
    }

    setLoading(true);
    try {
      const payload = { name: form.name };
      if (changePassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const res = await api.put('/auth/profile', payload);

      // Update localStorage
      const updatedUser = { ...user, name: res.data.name };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      onUpdate(updatedUser);

      setSuccess('Profil berhasil diperbarui!');
      setForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setChangePassword(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-box">
        <button className="btn-back" onClick={onBack}>← Kembali</button>

        <div className="profile-avatar">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <h2>{user.name}</h2>
        <p className="profile-email">{user.email}</p>

        <form onSubmit={handleSubmit} className="profile-form">
          <label>Nama</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <div
            className="toggle-password"
            onClick={() => setChangePassword(!changePassword)}
          >
            {changePassword ? '✕ Batal ganti password' : '🔑 Ganti password'}
          </div>

          {changePassword && (
            <>
              <label>Password Lama</label>
              <input
                type="password"
                name="currentPassword"
                placeholder="Masukkan password lama"
                value={form.currentPassword}
                onChange={handleChange}
              />
              <label>Password Baru</label>
              <input
                type="password"
                name="newPassword"
                placeholder="Minimal 6 karakter"
                value={form.newPassword}
                onChange={handleChange}
              />
              <label>Konfirmasi Password Baru</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Ulangi password baru"
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </>
          )}

          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <button type="submit" className="btn-save" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;