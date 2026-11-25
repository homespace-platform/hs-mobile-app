import axiosClient from '@/lib/axios-client';
import {
  FEED_MAX_LIMIT,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationFeedPage,
  type NotificationItem,
} from '@/lib/notification';
import type { ApiResponse } from '@/types/api';

// Same endpoints as web notificationService (hs-notification-service via Gateway).
const BASE = '/api/v1/notifications';

export async function getNotificationFeed(
  query: {
    limit?: number;
    cursor?: string | null;
    category?: NotificationCategory;
    unreadOnly?: boolean;
  } = {}
): Promise<NotificationFeedPage> {
  const params: Record<string, string | number | boolean> = {};
  if (typeof query.limit === 'number' && Number.isFinite(query.limit))
    params.limit = Math.min(Math.max(Math.trunc(query.limit), 1), FEED_MAX_LIMIT);
  if (query.cursor?.trim()) params.cursor = query.cursor.trim();
  if (query.category && (NOTIFICATION_CATEGORIES as readonly string[]).includes(query.category))
    params.category = query.category;
  if (query.unreadOnly) params.unreadOnly = true;
  const result = (
    await axiosClient.get<ApiResponse<NotificationFeedPage>>(`${BASE}/feed`, { params })
  ).data?.result;
  return {
    items: Array.isArray(result?.items) ? result.items : [],
    nextCursor: result?.nextCursor ?? null,
    hasMore: Boolean(result?.hasMore),
  };
}

export async function getUnreadNotificationCount() {
  const count = (await axiosClient.get<ApiResponse<{ count: number }>>(`${BASE}/unread-count`)).data
    ?.result?.count;
  return typeof count === 'number' ? Math.max(0, count) : 0;
}

export async function markNotificationRead(id: string) {
  return (
    await axiosClient.patch<ApiResponse<NotificationItem>>(
      `${BASE}/${encodeURIComponent(id.trim())}/read`
    )
  ).data.result;
}

export async function markAllNotificationsRead() {
  return (await axiosClient.patch<ApiResponse<{ updated: number }>>(`${BASE}/read-all`)).data
    ?.result;
}
