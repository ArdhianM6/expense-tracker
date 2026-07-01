import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import SummaryCard from '../components/SummaryCard';
import Chart from '../components/Chart';
import BarChart from '../components/BarChart';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import BudgetManager from '../components/BudgetManager';
import Toast from '../components/Toast';

function Dashboard({ user, onLogout, onOpenProfile, onOpenAnnual }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [trendData, setTrendData] = useState([]);
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const toastRef = useRef(null);

  const budgetKey = `budgets_${user.id}`;
  const [budgets, setBudgets] = useState(() => {
    const saved = localStorage.getItem(budgetKey);
    return saved ? JSON.parse(saved) : {};
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast({ message: '', type: 'success' }), 2500);
  };

  const handleSaveBudget = (newBudgets) => {
    setBudgets(newBudgets);
    localStorage.setItem(budgetKey, JSON.stringify(newBudgets));
    showToast('Budget berhasil diperbarui');
  };

  // Fetch data transaksi + summary bulan ini
  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, sumRes] = await Promise.all([
        api.get(`/transactions?month=${month}&year=${year}`),
        api.get(`/transactions/summary?month=${month}&year=${year}`),
      ]);
      setTransactions(txRes.data);
      setSummary(sumRes.data);
    } catch {
      showToast('Gagal memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data tren 6 bulan terakhir
  const fetchTrend = async () => {
    try {
      const results = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(year, month - 1 - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const res = await api.get(`/transactions/summary?month=${m}&year=${y}`);
        results.push({ month: m, year: y, ...res.data });
      }
      setTrendData(results);
    } catch {
      console.error('Gagal fetch tren');
    }
  };

  useEffect(() => {
    fetchData();
    fetchTrend();
  }, [month, year]);

  // Warning budget
  useEffect(() => {
    if (transactions.length === 0) return;
    Object.entries(budgets).forEach(([category, limit]) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category === category)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const percent = (spent / limit) * 100;
      if (percent >= 100) {
        showToast(`🚨 Budget ${category} melebihi limit!`, 'error');
      } else if (percent >= 80) {
        showToast(`⚠️ Budget ${category} hampir habis (${percent.toFixed(0)}%)`, 'info');
      }
    });
  }, [transactions]);

  const handleSubmit = async (form) => {
    try {
      if (editData) {
        await api.put(`/transactions/${editData.id}`, form);
        setEditData(null);
        showToast('Transaksi berhasil diperbarui');
      } else {
        await api.post('/transactions', form);
        showToast('Transaksi berhasil ditambahkan');
      }
      fetchData();
      fetchTrend();
    } catch {
      showToast('Gagal menyimpan transaksi', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      showToast('Transaksi berhasil dihapus');
      fetchData();
      fetchTrend();
    } catch {
      showToast('Gagal menghapus transaksi', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  const MONTHS = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];

  return (
    <div className="dashboard">
      <header className="dash-header">
        <h1>💰 Expense Tracker</h1>
        <div className="header-right">
        <button className="btn-annual" onClick={onOpenAnnual}>
      📅 Tahunan
        </button>
        <button className="btn-profile" onClick={onOpenProfile}>
        <span className="avatar-small">{user.name.charAt(0).toUpperCase()}</span>
      {user.name}
    </button>
    <button onClick={handleLogout} className="btn-logout">Logout</button>
  </div>
</header>

      <div className="month-filter">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <SummaryCard summary={summary} />

      <div className="main-content">
        <div className="left-panel">
          <TransactionForm
            onSubmit={handleSubmit}
            editData={editData}
            onCancelEdit={() => setEditData(null)}
          />
          <BudgetManager
            budgets={budgets}
            transactions={transactions}
            onSave={handleSaveBudget}
          />
          <Chart transactions={transactions} />
          <BarChart data={trendData} />
        </div>
        <div className="right-panel">
          {loading ? (
            <div className="transaction-list">
              <p className="no-data">Memuat...</p>
            </div>
          ) : (
            <TransactionList
              transactions={transactions}
              onEdit={setEditData}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} />
    </div>
  );
}

export default Dashboard;