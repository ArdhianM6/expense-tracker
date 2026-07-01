import { useState, useEffect } from 'react';

const CATEGORIES_EXPENSE = ['Makanan', 'Transportasi', 'Hiburan', 'Kesehatan', 'Belanja', 'Tagihan', 'Lainnya'];
const CATEGORIES_INCOME = ['Gaji', 'Freelance', 'Investasi', 'Hadiah', 'Lainnya'];

function TransactionForm({ onSubmit, editData, onCancelEdit }) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    category: 'Makanan',
    description: '',
    date: today,
  });

  useEffect(() => {
    if (editData) {
      setForm({
        type: editData.type,
        amount: editData.amount,
        category: editData.category,
        description: editData.description || '',
        date: editData.date.split('T')[0],
      });
    }
  }, [editData]);

  const handleChange = (e) => {
    const updated = { ...form, [e.target.name]: e.target.value };
    if (e.target.name === 'type') {
      updated.category = e.target.value === 'expense' ? 'Makanan' : 'Gaji';
    }
    setForm(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
    setForm({ type: 'expense', amount: '', category: 'Makanan', description: '', date: today });
  };

  const categories = form.type === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;

  return (
    <div className="form-card">
      <h3>{editData ? '✏️ Edit Transaksi' : '➕ Tambah Transaksi'}</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
          <select name="category" value={form.category} onChange={handleChange}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <input
            type="number"
            name="amount"
            placeholder="Jumlah (Rp)"
            value={form.amount}
            onChange={handleChange}
            required
            min="1"
          />
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
          />
        </div>
        <input
          type="text"
          name="description"
          placeholder="Keterangan (opsional)"
          value={form.description}
          onChange={handleChange}
        />
        <div className="form-actions">
          <button type="submit" className="btn-submit">
            {editData ? 'Simpan Perubahan' : 'Tambah'}
          </button>
          {editData && (
            <button type="button" className="btn-cancel" onClick={onCancelEdit}>
              Batal
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default TransactionForm;