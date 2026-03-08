// src/api/notifications.ts
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id:         number;
  type:       string;
  title:      string;
  message:    string;
  data:       Record<string, unknown> | null;
  link:       string | null;
  is_read:    boolean;
  read_at:    string | null;
  created_at: string;
}

export interface NotificationPage {
  data:         AppNotification[];
  total:        number;
  current_page: number;
  last_page:    number;
}

export interface UnreadCountResponse {
  count: number;
}

// ─── Type → icon / color config ──────────────────────────────────────────────

export const NOTIF_TYPE_CFG: Record<string, { label: string; color: string; iconName: string }> = {
  DEMANDE_CREEE:          { label: 'Nouvelle demande',     color: 'text-blue-600',   iconName: 'FilePlus' },
  DEMANDE_APPROUVEE_DEPT: { label: 'Approuvée — dept',     color: 'text-green-600',  iconName: 'CheckCircle' },
  DEMANDE_REFUSEE_DEPT:   { label: 'Refusée — dept',       color: 'text-red-600',    iconName: 'XCircle' },
  DEMANDE_TRAITEE_STOCK:  { label: 'Traitée — stock',      color: 'text-indigo-600', iconName: 'Package' },
  DEMANDE_LIVREE:         { label: 'Livrée',               color: 'text-emerald-600',iconName: 'Truck' },
  ALERTE_STOCK:           { label: 'Alerte stock',         color: 'text-amber-600',  iconName: 'AlertTriangle' },
};

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Fetch notifications with optional filters.
 * @param unread    - if true, returns only unread
 * @param per_page  - page size (max 100)
 * @param page      - page number
 */
export async function fetchNotifications(
  { unread = false, per_page = 20, page = 1 }: { unread?: boolean; per_page?: number; page?: number } = {}
): Promise<NotificationPage> {
  const params: Record<string, string | number> = { per_page, page };
  if (unread) params.unread = '1';

  const res = await api.get<NotificationPage>('/notifications', { params });
  return res.data;
}

/**
 * Fast badge count — call this on every route change.
 */
export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get<UnreadCountResponse>('/notifications/unread-count');
  return res.data.count;
}

/**
 * Mark a single notification as read.
 * Returns the updated notification.
 */
export async function markRead(id: number): Promise<AppNotification> {
  const res = await api.post<AppNotification>(`/notifications/${id}/read`);
  return res.data;
}

/**
 * Mark all notifications as read.
 */
export async function markAllRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

/**
 * Delete a single notification.
 */
export async function deleteNotification(id: number): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

/**
 * Delete all notifications for the current user.
 */
export async function deleteAllNotifications(): Promise<void> {
  await api.delete('/notifications');
}