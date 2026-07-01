import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

const PAGE_SIZE = 8;

function TransactionList({ transactions, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState(null);

  const format = (num) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(num);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.category.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1); // reset ke halaman 1 saat search
  };

  const handleConfirmDelete = () => {
    onDelete(confirmId);
    setConfirmId(null);
  };

  return (
    <div className="transaction-list">
      <h3>📋 Riwayat Transaksi</h3>

      {/* Search */}
      <div className="search-wrap">
        <input
          type="text"
          placeholder="🔍 Cari kategori atau keterangan..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
        />
        {search && (
          <button className="search-clear" onClick={() => handleSearch('')}>×</button>
        )}
      </div>

      {/* Empty state */}
      {transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">📭</div>
          <h4>Belum ada transaksi</h4>
          <p>Tambahkan transaksi pertamamu menggunakan form di sebelah kiri.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">🔍</div>
          <h4>Tidak ditemukan</h4>
          <p>Tidak ada transaksi yang cocok dengan "<strong>{search}</strong>"</p>
        </div>
      ) : (
        <>
          {search && (
            <p className="search-result-info">
              Menampilkan {filtered.length} dari {transactions.length} transaksi
            </p>
          )}

          {paginated.map((t) => (
            <div key={t.id} className={`transaction-item ${t.type}`}>
              <div className="transaction-left">
                <span className="transaction-category">{t.category}</span>
                <span className="transaction-desc">{t.description || '-'}</span>
                <span className="transaction-date">{formatDate(t.date)}</span>
              </div>
              <div className="transaction-right">
                <span className="transaction-amount">
                  {t.type === 'income' ? '+' : '-'} {format(t.amount)}
                </span>
                <div className="transaction-btns">
                  <button onClick={() => onEdit(t)} title="Edit">✏️</button>
                  <button onClick={() => setConfirmId(t.id)} title="Hapus">🗑️</button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >← Prev</button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={page === p ? 'page-active' : ''}
                >{p}</button>
              ))}

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
              >Next →</button>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        message={confirmId ? 'Yakin ingin menghapus transaksi ini?' : null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

export default TransactionList;