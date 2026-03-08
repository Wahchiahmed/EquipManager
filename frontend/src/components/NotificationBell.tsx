// src/components/NotificationBell.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, X, Check, CheckCheck, Package,
  FilePlus, CheckCircle, XCircle, Truck, AlertTriangle,
  ChevronRight, Loader2,
} from 'lucide-react';
import {
  AppNotification,
  NOTIF_TYPE_CFG,
  fetchNotifications,
  fetchUnreadCount,
  markRead,
  markAllRead,
} from '@/api/notifications';

// ─── Icon resolver (avoids dynamic require) ───────────────────────────────────
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  FilePlus,
  CheckCircle,
  XCircle,
  Package,
  Truck,
  AlertTriangle,
};

function NotifIcon({ type, className }: { type: string; className?: string }) {
  const cfg  = NOTIF_TYPE_CFG[type];
  const Icon = cfg ? (ICON_MAP[cfg.iconName] ?? Bell) : Bell;
  return <Icon className={className} />;
}

// ─── Time ago helper ──────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `À l'instant`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  /** Optional: provide external unread count + setter to keep badge in sync */
  externalCount?: number;
  onCountChange?: (newCount: number) => void;
}

const POLL_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
const NotificationBell: React.FC<Props> = ({ externalCount, onCountChange }) => {
  const navigate = useNavigate();

  const [open, setOpen]                 = useState(false);
  const [notifications, setNotifs]      = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount]   = useState(externalCount ?? 0);
  const [loading, setLoading]           = useState(false);
  const dropdownRef                     = useRef<HTMLDivElement>(null);

  // ── Sync external count ─────────────────────────────────────────────────────
  useEffect(() => {
    if (externalCount !== undefined) setUnreadCount(externalCount);
  }, [externalCount]);

  const updateCount = useCallback((n: number) => {
    setUnreadCount(n);
    onCountChange?.(n);
  }, [onCountChange]);

  // ── Poll unread count ───────────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try { updateCount(await fetchUnreadCount()); } catch { /* silent */ }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [updateCount]);

  // ── Load latest 10 when dropdown opens ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchNotifications({ per_page: 10 })
      .then(page => setNotifs(page.data))
      .finally(() => setLoading(false));
  }, [open]);

  // ── Close on outside click or Escape ───────────────────────────────────────
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // ── Click notification ──────────────────────────────────────────────────────
  const handleClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markRead(notif.id);
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      updateCount(Math.max(0, unreadCount - 1));
    }
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  };

  // ── Mark all read ───────────────────────────────────────────────────────────
  const handleMarkAll = async () => {
    await markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    updateCount(0);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div ref={dropdownRef} className="relative">

      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center
                   text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1
                           bg-red-500 text-white text-[10px] font-bold rounded-full
                           flex items-center justify-center leading-none animate-bounce-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-card border border-border
                        rounded-xl shadow-xl z-[200] overflow-hidden animate-fade-in">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm text-foreground">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({unreadCount} non lue{unreadCount > 1 ? 's' : ''})
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  title="Tout marquer comme lu"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => { navigate('/notifications'); setOpen(false); }}
                title="Voir tout"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Chargement…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucune notification</p>
              </div>
            ) : (
              notifications.map(notif => {
                const cfg   = NOTIF_TYPE_CFG[notif.type];
                const color = cfg?.color ?? 'text-muted-foreground';
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3
                                border-b border-border/60 last:border-0 transition-colors
                                hover:bg-muted/50 ${!notif.is_read ? 'bg-primary/5' : ''}`}
                  >
                    {/* Unread dot */}
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}

                    {/* Icon */}
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                                     bg-muted ${!notif.is_read ? 'ml-0' : 'ml-4'}`}>
                      <NotifIcon type={notif.type} className={`w-3.5 h-3.5 ${color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${!notif.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/30">
              <button
                onClick={() => { navigate('/notifications'); setOpen(false); }}
                className="w-full text-xs font-semibold text-primary hover:underline text-center"
              >
                Voir toutes les notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;