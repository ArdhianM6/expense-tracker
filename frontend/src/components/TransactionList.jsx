import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

const PAGE_SIZE = 8;
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);

function TransactionList({ transactions, onEdit, onDelete, month, year, currentUserId, role }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState(null);

  const categories = [...new Set(transactions.map((item) => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'id'));
  const query = search.trim().toLocaleLowerCase('id');
  const filtered = transactions.filter((item) => (
    `${item.category || ''} ${item.description || ''}`.toLocaleLowerCase('id').includes(query)
    && (typeFilter === 'all' || item.type === typeFilter)
    && (categoryFilter === 'all' || item.category === categoryFilter)
  ));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const columns = ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah (IDR)'];
    const safeCell = (value) => {
      const text = String(value ?? '');
      const protectedText = /^[-=+@\t\r]/.test(text) ? `'${text}` : text;
      return `"${protectedText.replaceAll('"', '""')}"`;
    };
    const rows = filtered.map((item) => [
      String(item.date).slice(0, 10),
      item.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      item.category,
      item.description,
      item.amount,
    ]);
    const csv = `\uFEFF${[columns, ...rows].map((row) => row.map(safeCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `transaksi-${year}-${String(month).padStart(2, '0')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = () => {
    onDelete(confirmId);
    setConfirmId(null);
  };

  return (
    <section className="transaction-list" aria-labelledby="transaction-title">
      <div className="transaction-heading">
        <div>
          <h2 id="transaction-title">Riwayat transaksi</h2>
          <p>{filtered.length} dari {transactions.length} transaksi</p>
        </div>
        <button className="export-button" onClick={exportCsv} disabled={!filtered.length}>
          Ekspor CSV
        </button>
      </div>

      <div className="transaction-tools">
        <label className="search-field">
          <span className="visually-hidden">Cari transaksi</span>
          <span className="search-symbol" aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Cari kategori atau keterangan"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            className="search-input"
          />
        </label>
        <label className="filter-field">
          <span>Jenis</span>
          <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
            <option value="all">Semua jenis</option>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Kategori</span>
          <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
            <option value="all">Semua kategori</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">
          <h3>Belum ada transaksi</h3>
          <p>Catat transaksi pertama untuk mulai melihat ringkasan keuangan.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Tidak ada hasil yang cocok</h3>
          <p>Ubah kata kunci atau filter untuk melihat transaksi lain.</p>
        </div>
      ) : (
        <>
          <div className="transaction-table-scroll">
            <table className="transaction-table">
              <thead><tr><th>Tanggal</th><th>Transaksi</th><th>Kategori</th><th>Jumlah</th><th>Aksi</th></tr></thead>
              <tbody>
                {paginated.map((item) => (
                  <tr key={item.id}>
                    <td>{new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.date))}</td>
                    <td>
                      <span className="table-description">{item.description || item.category || 'Transaksi'}</span>
                      <span className="table-type">{item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span>
                    </td>
                    <td><span className="category-pill">{item.category || 'Lainnya'}</span></td>
                    <td className={`table-amount ${item.type}`}>
                      {item.type === 'income' ? '+' : '−'}{formatCurrency(item.amount)}
                    </td>
                    <td>
                      {(role === 'admin' || Number(item.user_id) === Number(currentUserId)) ? (
                        <div className="transaction-btns">
                          <button onClick={() => onEdit(item)} aria-label={`Edit ${item.description || item.category || 'transaksi'}`}>Edit</button>
                          <button onClick={() => setConfirmId(item.id)} aria-label={`Hapus ${item.description || item.category || 'transaksi'}`}>Hapus</button>
                        </div>
                      ) : <span aria-label="Hanya admin yang dapat mengubah">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination" aria-label="Halaman transaksi">
              <button onClick={() => setPage((current) => current - 1)} disabled={page === 1}>Sebelumnya</button>
              <span>Halaman {page} dari {totalPages}</span>
              <button onClick={() => setPage((current) => current + 1)} disabled={page === totalPages}>Berikutnya</button>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        message={confirmId ? 'Yakin ingin menghapus transaksi ini?' : null}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
      />
    </section>
  );
}

export default TransactionList;
