import React, { useState } from 'react';
import { Bell, Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { mockNotifications } from '@/data/mockData';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
          import NotificationBell from '@/components/NotificationBell';


const Navbar: React.FC = () => {
  const { currentUser } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(
    mockNotifications.filter(n => n.id_user === currentUser?.id_utilisateur)
  );

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

  const markRead = (id: number) =>
    setNotifications(prev =>
      prev.map(n => n.id_notification === id ? { ...n, is_read: true } : n)
    );

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 gap-4 shrink-0">

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border border-transparent
                     focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20
                     transition-all placeholder:text-muted-foreground"
        />
      </div>

      {/* ── Right actions ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Theme toggle — dropdown with Clair / Sombre / Système */}
        <ThemeToggle variant="dropdown" />

        {/* Notifications ───────────────────────────────────────────────── */}
        <div className="relative">
          <NotificationBell />

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-card rounded-xl shadow-lg border border-border
                            z-50 overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                      Tout lire
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">Aucune notification</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id_notification}
                      onClick={() => markRead(n.id_notification)}
                      className={cn(
                        'px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors',
                        !n.is_read && 'bg-primary/5'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        )}
                        <div className={cn(!n.is_read ? 'ml-0' : 'ml-4')}>
                          <p className="text-xs text-foreground leading-relaxed">{n.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">{n.created_at}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center
                          text-primary-foreground text-xs font-bold shadow-brand">
            {currentUser?.prenom[0]}{currentUser?.nom[0]}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold text-foreground">
              {currentUser?.prenom} {currentUser?.nom}
            </p>
            <p className="text-[11px] text-muted-foreground">{currentUser?.departement_nom}</p>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Navbar;