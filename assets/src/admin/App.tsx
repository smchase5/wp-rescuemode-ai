import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import ConflictScanner from './pages/ConflictScanner';
import Logs from './pages/Logs';

const App = () => {
  const [page, setPage] = useState('dashboard');

  // Load initial state from hash
  React.useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'settings', 'scanner', 'logs'].includes(hash)) {
      setPage(hash);
    }
  }, []);

  // Update hash when page changes
  const handleNavigate = (newPage: string) => {
    setPage(newPage);
    window.location.hash = newPage;
  };

  return (
    <Layout activePage={page} onNavigate={handleNavigate}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'settings' && <Settings />}
      {page === 'scanner' && <ConflictScanner />}
      {page === 'logs' && <Logs />}
    </Layout>
  );
};

export default App;
