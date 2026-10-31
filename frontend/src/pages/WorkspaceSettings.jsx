import { useEffect, useState } from 'react';
import api from '../api/axios';

function WorkspaceSettings({ user, onBack, onWorkspaceChanged }) {
  const [organizations, setOrganizations] = useState([]);
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/organizations'),
      api.get(`/organizations/${user.orgId}/members`),
    ])
      .then(([organizationResponse, memberResponse]) => {
        if (!ignore) {
          setOrganizations(organizationResponse.data);
          setMembers(memberResponse.data);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          const status = requestError.response?.status;
          const detail = requestError.response?.data?.error;
          const message = status === 429
            ? 'Terlalu banyak permintaan. Tunggu sebentar, lalu coba muat ulang.'
            : status === 401 || status === 403
              ? detail || 'Sesi atau akses workspace tidak berlaku. Keluar lalu login kembali.'
              : detail || 'Workspace atau daftar anggota gagal dimuat. Periksa koneksi backend dan database.';
          setError(message);
        }
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [user.orgId, reloadKey]);

  const switchWorkspace = async (organizationId) => {
    setError('');
    try {
      const { data } = await api.post(`/organizations/${organizationId}/switch`);
      localStorage.setItem('token', data.token);
      onWorkspaceChanged({
        ...user,
        orgId: data.organization.id,
        organizationName: data.organization.name,
        role: data.organization.role,
      });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Workspace gagal diganti.');
    }
  };

  const inviteMember = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/organizations/${user.orgId}/members`, { email });
      setMessage(data.message);
      setEmail('');
      const membersResponse = await api.get(`/organizations/${user.orgId}/members`);
      setMembers(membersResponse.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Anggota gagal ditambahkan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="workspace-page">
      <button className="btn-back" onClick={onBack}>Kembali ke ringkasan</button>
      <header className="workspace-title">
        <div><h1>Workspace dan anggota</h1><p>Kelola ruang kerja tim keuangan Anda.</p></div>
        <span className="role-badge">{user.role === 'admin' ? 'Admin' : 'Anggota'}</span>
      </header>

      {error && <p className="workspace-message error-msg" role="alert">{error}</p>}
      {error && !loading && <button className="workspace-action" onClick={() => setReloadKey((key) => key + 1)}>Coba muat ulang</button>}
      {message && <p className="workspace-message success-msg" role="status">{message}</p>}

      <section className="workspace-panel">
        <div className="workspace-section-heading"><h2>Workspace Anda</h2><p>Data transaksi dan anggaran mengikuti workspace aktif.</p></div>
        {loading ? <p className="workspace-muted">Memuat workspace…</p> : (
          <ul className="workspace-list">
            {organizations.map((organization) => (
              <li key={organization.id} className={Number(user.orgId) === organization.id ? 'workspace-item current' : 'workspace-item'}>
                <div><strong>{organization.name}</strong><span>{organization.role === 'admin' ? 'Admin' : 'Anggota'}</span></div>
                {Number(user.orgId) === organization.id ? <span className="current-workspace">Aktif</span> : (
                  <button className="workspace-action" onClick={() => switchWorkspace(organization.id)}>Gunakan workspace</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="workspace-panel">
        <div className="workspace-section-heading"><h2>Anggota workspace aktif</h2><p>Admin dapat mengubah transaksi dan anggaran. Anggota dapat mencatat transaksi sendiri.</p></div>
        <ul className="member-list">
          {members.map((member) => (
            <li className="member-row" key={member.id}>
              <span className="member-avatar">{member.name.slice(0, 1).toUpperCase()}</span>
              <div><strong>{member.name}</strong><span>{member.email}</span></div>
              <span className="role-badge">{member.role === 'admin' ? 'Admin' : 'Anggota'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="workspace-panel">
        <div className="workspace-section-heading"><h2>Tambahkan anggota</h2><p>Anggota perlu membuat akun terlebih dahulu sebelum diundang.</p></div>
        {user.role === 'admin' ? (
          <form className="invite-form" onSubmit={inviteMember}>
            <label htmlFor="member-email">Email akun anggota</label>
            <div><input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@perusahaan.id" required />
              <button className="invite-button" disabled={saving}>{saving ? 'Menambahkan…' : 'Tambahkan anggota'}</button></div>
          </form>
        ) : <p className="workspace-muted">Minta admin workspace untuk menambahkan anggota.</p>}
      </section>
    </main>
  );
}

export default WorkspaceSettings;
