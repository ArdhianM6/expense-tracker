import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';
import SummaryCard from '../components/SummaryCard';
import Chart from '../components/Chart';
import BarChart from '../components/BarChart';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import BudgetManager from '../components/BudgetManager';
import Toast from '../components/Toast';

function Dashboard({ user, onLogout, onOpenProfile, onOpenAnnual, onOpenActivity, onOpenWorkspace }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [trendData, setTrendData] = useState([]);
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const toastRef = useRef(null);

  const [budgets, setBudgets] = useState({});

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast({ message: '', type: 'success' }), 2500);
  }, []);

  const handleSaveBudget = (newBudgets) => {
    const previous = budgets;
    const requests = Object.entries(newBudgets).filter(([category, amount]) => previous[category] !== amount).map(([category, amount]) =>
      api.post('/budgets', { category, amount, month, year })
    );
    Object.keys(previous).filter((category) => !(category in newBudgets)).forEach((category) => {
      requests.push(api.delete(`/budgets/${encodeURIComponent(category)}?month=${month}&year=${year}`));
    });
    if (requests.length === 0) {
      setBudgets(newBudgets);
      return;
    }
    Promise.all(requests).then(() => {
      setBudgets(newBudgets);
      showToast('Budget tersimpan di database');
    }).catch(() => showToast('Gagal menyimpan budget', 'error'));
  };

  useEffect(() => {
    let ignore = false;
    const trendRequests = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(year, month - 1 - (5 - index), 1);
      const trendMonth = date.getMonth() + 1;
      const trendYear = date.getFullYear();
      return api.get(`/transactions/summary?month=${trendMonth}&year=${trendYear}`)
        .then(({ data }) => ({ month: trendMonth, year: trendYear, ...data }));
    });
    Promise.all([
      api.get(`/transactions?month=${month}&year=${year}`),
      api.get(`/transactions/summary?month=${month}&year=${year}`),
      api.get(`/budgets?month=${month}&year=${year}`),
      ...trendRequests,
    ])
      .then(([transactionResponse, summaryResponse, budgetResponse, ...trend]) => {
        if (ignore) return;
        setTransactions(transactionResponse.data);
        setSummary(summaryResponse.data);
        setBudgets(Object.fromEntries(budgetResponse.data.map((item) => [item.category, Number(item.amount)])));
        setTrendData(trend);
      })
      .catch(() => { if (!ignore) showToast('Gagal memuat data periode ini', 'error'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [month, year, refreshKey, showToast]);

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
  }, [transactions, budgets, showToast]);

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
      setRefreshKey((current) => current + 1);
    } catch {
      showToast('Gagal menyimpan transaksi', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      showToast('Transaksi berhasil dihapus');
      setRefreshKey((current) => current + 1);
    } catch {
      showToast('Gagal menghapus transaksi', 'error');
    }
  };

  const handleLogout = () => {
    const token = localStorage.getItem('token');
    api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  const MONTHS = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];
  const years = Array.from({ length: 8 }, (_, index) => now.getFullYear() - 5 + index);

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="brand-lockup">
          <h1>Expense Tracker</h1>
          <span>{user.organizationName || 'Workspace'}</span>
        </div>
        <div className="header-right">
          <nav className="primary-nav" aria-label="Navigasi utama">
            <button className="nav-link active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Ringkasan</button>
            <button className="nav-link" onClick={onOpenAnnual}>Laporan</button>
            <button className="nav-link" onClick={onOpenActivity}>Aktivitas</button>
            <button className="nav-link" onClick={onOpenWorkspace}>Workspace</button>
          </nav>
          <button className="btn-profile" onClick={onOpenProfile}>
            <span className="avatar-small">{user.name.charAt(0).toUpperCase()}</span>
            {user.name}
          </button>
          <button onClick={handleLogout} className="btn-logout">Keluar</button>
        </div>
      </header>

      <div className="month-filter">
        <select value={month} onChange={(e) => { setLoading(true); setMonth(Number(e.target.value)); }}>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => { setLoading(true); setYear(Number(e.target.value)); }}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <SummaryCard summary={summary} />

      <div className="main-content">
        <div className="left-panel">
          <TransactionForm
            key={editData?.id ?? 'new'}
            onSubmit={handleSubmit}
            editData={editData}
            onCancelEdit={() => setEditData(null)}
          />
          <BudgetManager
            budgets={budgets}
            transactions={transactions}
            onSave={handleSaveBudget}
            readOnly={user.role !== 'admin'}
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
              month={month}
              year={year}
              currentUserId={user.id}
              role={user.role}
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
