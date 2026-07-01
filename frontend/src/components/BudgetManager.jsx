import { useState } from 'react';

const CATEGORIES_EXPENSE = [
  'Makanan', 'Transportasi', 'Hiburan',
  'Kesehatan', 'Belanja', 'Tagihan', 'Lainnya'
];

function BudgetManager({ budgets, transactions, onSave }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: 'Makanan', limit: '' });

  const format = (num) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(num);

  const getSpent = (category) =>
    transactions
      .filter((t) => t.type === 'expense' && t.category === category)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.limit || form.limit <= 0) return;
    onSave({ ...budgets, [form.category]: parseFloat(form.limit) });
    setForm({ category: 'Makanan', limit: '' });
  };

  const handleRemove = (category) => {
    const updated = { ...budgets };
    delete updated[category];
    onSave(updated);
  };

  return (
    <div className="budget-card">
      <div className="budget-header" onClick={() => setOpen(!open)}>
        <h3>🎯 Budget per Kategori</h3>
        <span className="budget-toggle">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="budget-body">
          {/* Form set budget */}
          <form onSubmit={handleSave} className="budget-form">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES_EXPENSE.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Limit (Rp)"
              value={form.limit}
              onChange={(e) => setForm({ ...form, limit: e.target.value })}
              min="1"
              required
            />
            <button type="submit">Set</button>
          </form>

          {/* Daftar budget yang sudah diset */}
          {Object.keys(budgets).length === 0 ? (
            <p className="budget-empty">Belum ada budget yang diset.</p>
          ) : (
            <div className="budget-list">
              {Object.entries(budgets).map(([category, limit]) => {
                const spent = getSpent(category);
                const percent = Math.min((spent / limit) * 100, 100);
                const isWarning = percent >= 80 && percent < 100;
                const isOver = spent > limit;

                return (
                  <div key={category} className="budget-item">
                    <div className="budget-item-top">
                      <span className="budget-cat">{category}</span>
                      <div className="budget-item-right">
                        <span className={`budget-status ${isOver ? 'over' : isWarning ? 'warning' : ''}`}>
                          {isOver ? '🚨 Melebihi!' : isWarning ? '⚠️ Hampir habis' : '✅ Aman'}
                        </span>
                        <button
                          className="budget-remove"
                          onClick={() => handleRemove(category)}
                        >×</button>
                      </div>
                    </div>

                    <div className="budget-progress-wrap">
                      <div
                        className={`budget-progress-bar ${isOver ? 'over' : isWarning ? 'warning' : ''}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="budget-numbers">
                      <span>{format(spent)} dipakai</span>
                      <span>Limit: {format(limit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BudgetManager;