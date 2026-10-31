import { useEffect, useState } from 'react';
import api from '../api/axios';

const ACTIONS = {
  created: 'menambahkan',
  updated: 'mengubah',
  deleted: 'menghapus',
  saved: 'menyimpan',
};

function ActivityLog({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    api.get('/audit-logs')
      .then(({ data }) => { if (!ignore) setItems(data); })
      .catch(() => { if (!ignore) setError('Riwayat aktivitas gagal dimuat. Coba muat ulang halaman.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const formatDate = (value) => new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));

  const detailText = (item) => {
    const details = item.details || {};
    if (item.entity === 'transaction') {
      const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(details.amount || 0);
      return `${details.category || 'Transaksi'} · ${amount}`;
    }
    if (item.entity === 'member') return details.email || 'Anggota workspace';
    return `${details.category || 'Anggaran'}${details.month ? ` · ${details.month}/${details.year}` : ''}`;
  };

  return (
    <main className="activity-page">
      <header className="activity-header">
        <div>
          <button className="btn-back" onClick={onBack}>Kembali ke ringkasan</button>
          <h1>Riwayat aktivitas</h1>
          <p>Perubahan terbaru pada transaksi dan anggaran akun ini.</p>
        </div>
        <span className="activity-count">{items.length} aktivitas terakhir</span>
      </header>
      {loading ? <div className="activity-panel">Memuat aktivitas…</div> : error ? (
        <div className="activity-panel error-msg" role="alert">{error}</div>
      ) : items.length === 0 ? (
        <div className="activity-panel activity-empty">
          <h2>Belum ada aktivitas</h2>
          <p>Perubahan transaksi dan anggaran akan tercatat di sini.</p>
        </div>
      ) : (
        <ol className="activity-timeline">
          {items.map((item) => (
            <li className="activity-row" key={item.id}>
              <span className={`activity-dot ${item.action}`} aria-hidden="true" />
              <div className="activity-description">
                <strong>{item.actor_name ? `${item.actor_name} ` : ''}{ACTIONS[item.action] || item.action} {item.entity === 'budget' ? 'anggaran' : item.entity === 'member' ? 'anggota' : 'transaksi'}</strong>
                <span>{detailText(item)}</span>
              </div>
              <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

export default ActivityLog;
