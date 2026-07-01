import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import AnnualSummary from './pages/AnnualSummary';
import Onboarding from './components/Onboarding';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [page, setPage] = useState('dashboard');

  // Cek apakah user ini sudah pernah onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (!localStorage.getItem('user')) return false;
    const userId = JSON.parse(localStorage.getItem('user'))?.id;
    return !localStorage.getItem(`onboarded_${userId}`);
  });

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    const alreadyOnboarded = localStorage.getItem(`onboarded_${loggedInUser.id}`);
    setShowOnboarding(!alreadyOnboarded);
  };

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
    </>
  );
}

export default App;