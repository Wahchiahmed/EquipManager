import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [inscriptionBadge, setInscriptionBadge] = useState(0);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser?.role_nom !== 'ADMIN') return;

    const fetchBadge = () => {
      api.get('/admin/inscriptions/stats')
        .then(r => setInscriptionBadge(r.data.en_attente ?? 0))
        .catch(() => {});
    };

    fetchBadge();
    const id = setInterval(fetchBadge, 60_000);
    return () => clearInterval(id);
  }, [currentUser]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        inscriptionBadge={inscriptionBadge}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;