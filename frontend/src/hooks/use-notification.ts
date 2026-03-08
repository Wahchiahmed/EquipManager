// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppNotification,
  fetchUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
} from '@/api/notifications';

const POLL_INTERVAL_MS = 30_000; // 30 s

export function useUnreadCount() {
  const [count, setCount]   = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCount(await fetchUnreadCount());
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { count, setCount, loading, refresh };
}

export function useNotificationActions(
  onCountChange: (delta: number) => void
) {
  const navigate = useNavigate();

  const handleClickNotif = useCallback(async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markRead(notif.id);
      onCountChange(-1);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  }, [navigate, onCountChange]);

  const handleMarkAllRead = useCallback(async (
    notifications: AppNotification[],
    setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>
  ) => {
    await markAllRead();
    const unreadCount = notifications.filter(n => !n.is_read).length;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
    onCountChange(-unreadCount);
  }, [onCountChange]);

  const handleDelete = useCallback(async (
    id: number,
    notifications: AppNotification[],
    setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>
  ) => {
    const target = notifications.find(n => n.id === id);
    await deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (target && !target.is_read) onCountChange(-1);
  }, [onCountChange]);

  return { handleClickNotif, handleMarkAllRead, handleDelete };
}