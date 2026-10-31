import { useEffect, useState } from 'react';
import api from './api/axios';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import AnnualSummary from './pages/AnnualSummary';
import ActivityLog from './pages/ActivityLog';
import WorkspaceSettings from './pages/WorkspaceSettings';
import Onboarding from './components/Onboarding';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(localStorage.getItem('token')));

  useEffect(() => {
    if ('caches' in window) window.caches.delete('api-cache');
    const handleExpired = () => setUser(null);
    window.addEventListener('auth:expired', handleExpired);
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.removeItem('user');
      return () => window.removeEventListener('auth:expired', handleExpired);
    }
    api.get('/auth/me')
      .then(({ data }) => {
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => setCheckingSession(false));
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const [page, setPage] = useState('dashboard');

  // Cek apakah user ini sudah pernah onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return false;
  });

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    const alreadyOnboarded = localStorage.getItem(`onboarded_${loggedInUser.id}`);
    setShowOnboarding(!alreadyOnboarded);
  };

  if (checkingSession) return <div className="session-loading">Memeriksa sesi...</div>;

  const handleFinishOnboarding = () => {
    localStorage.setItem(`onboarded_${user.id}`, 'true');
    setShowOnboarding(false);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <>
      {showOnboarding && <Onboarding onFinish={handleFinishOnboarding} />}

      {page === 'dashboard' && (
        <Dashboard
          user={user}
          onLogout={() => setUser(null)}
          onOpenProfile={() => setPage('profile')}
          onOpenAnnual={() => setPage('annual')}
          onOpenActivity={() => setPage('activity')}
          onOpenWorkspace={() => setPage('workspace')}
        />
      )}

      {page === 'profile' && (
        <Profile
          user={user}
          onUpdate={(updated) => setUser(updated)}
          onBack={() => setPage('dashboard')}
        />
      )}

      {page === 'annual' && (
        <AnnualSummary onBack={() => setPage('dashboard')} />
      )}

      {page === 'activity' && (
        <ActivityLog onBack={() => setPage('dashboard')} />
      )}

      {page === 'workspace' && (
        <WorkspaceSettings user={user} onBack={() => setPage('dashboard')} onWorkspaceChanged={(updated) => { setUser(updated); setPage('dashboard'); }} />
      )}
    </>
  );
}

export default App;
