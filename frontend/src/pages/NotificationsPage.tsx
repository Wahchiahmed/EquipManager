// src/pages/NotificationsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Trash2, X, Package, FilePlus,
  CheckCircle, XCircle, Truck, AlertTriangle, Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  AppNotification,
  NotificationPage,
  NOTIF_TYPE_CFG,
  fetchNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
} from '@/api/notifications';

// ─── Icon resolver ────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  FilePlus, CheckCircle, XCircle, Package, Truck, AlertTriangle,
};
function NotifIcon({ type, className }: { type: string; className?: string }) {
  const cfg  = NOTIF_TYPE_CFG[type];
  const Icon = cfg ? (ICON_MAP[cfg.iconName] ?? Bell) : Bell;
  return <Icon className={className} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Types for tabs ───────────────────────────────────────────────────────────
type Tab = 'all' | 'unread';

// ─────────────────────────────────────────────────────────────────────────────
const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();

  const [tab, setTab]                   = useState<Tab>('all');
  const [page, setPage]                 = useState(1);
  const [pageData, setPageData]         = useState<NotificationPage | null>(null);
  const [notifications, setNotifs]      = useState<AppNotification[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [deletingAll, setDeletingAll]   = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async (tabVal: Tab, pageVal: number, append = false) => {
    setLoading(!append);
    setRefreshing(append);
    try {
      const data = await fetchNotifications({
        unread:   tabVal === 'unread',
        per_page: 20,
        page:     pageVal,
      });
      setPageData(data);
      setNotifs(prev => append ? [...prev, ...data.data] : data.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    setNotifs([]);
    load(tab, 1);
  }, [tab, load]);

  const loadMore = () => {
    if (pageData && page < pageData.last_page) {
      const next = page + 1;
      setPage(next);
      load(tab, next, true);
    }
  };

  // ── Mark single as read ───────────────────────────────────────────────────
  const handleClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markRead(notif.id);
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    if (notif.link) navigate(notif.link);
  };

  // ── Mark all read ─────────────────────────────────────────────────────────
  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  // ── Delete single ─────────────────────────────────────────────────────────
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(id);
    setNotifs(prev => prev.filter(n => n.id !== id));
    if (pageData) setPageData(d => d ? { ...d, total: d.total - 1 } : d);
  };

  // ── Delete all ────────────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (!confirm('Supprimer toutes les notifications ?')) return;
    setDeletingAll(true);
    try {
      await deleteAllNotifications();
      setNotifs([]);
      setPageData(null);
    } finally {
      setDeletingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
          </h1>
          {pageData && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {pageData.total} notification{pageData.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                         bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tout marquer lu
            </button>
          )}
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll || notifications.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                       border border-border text-muted-foreground rounded-lg
                       hover:bg-red-50 hover:border-red-300 hover:text-red-600
                       dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
          >
            {deletingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Tout supprimer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(['all', 'unread'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              tab === t
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'all' ? 'Toutes' : 'Non lues'}
            {t === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-9 h-9 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground font-medium">
              {tab === 'unread' ? 'Aucune notification non lue 🎉' : 'Aucune notification'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(notif => {
              const cfg   = NOTIF_TYPE_CFG[notif.type];
              const color = cfg?.color ?? 'text-muted-foreground';

              return (
                <div
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`group flex items-start gap-3 px-5 py-4 cursor-pointer
                              hover:bg-muted/40 transition-colors
                              ${!notif.is_read ? 'bg-primary/5' : ''}`}
                >
                  {/* Unread indicator */}
                  <div className="shrink-0 mt-1">
                    {!notif.is_read
                      ? <span className="w-2.5 h-2.5 rounded-full bg-primary block" />
                      : <span className="w-2.5 h-2.5 block" />
                    }
                  </div>

                  {/* Icon */}
                  <div className={`shrink-0 w-9 h-9 rounded-xl bg-muted flex items-center justify-center`}>
                    <NotifIcon type={notif.type} className={`w-4 h-4 ${color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${!notif.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {fmtDate(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    {cfg && (
                      <span className={`inline-flex mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted ${color}`}>
                        {cfg.label}
                      </span>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(notif.id, e)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                               text-muted-foreground hover:text-red-600 hover:bg-red-50
                               dark:hover:bg-red-900/20 transition-all"
                    title="Supprimer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {pageData && page < pageData.last_page && (
          <div className="flex justify-center py-4 border-t border-border">
            <button
              onClick={loadMore}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary
                         hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Charger plus
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;