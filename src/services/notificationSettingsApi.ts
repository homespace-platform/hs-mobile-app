import axiosClient from '@/lib/axios-client';
import {
  withDefaultPreferences,
  type NotificationCategory,
  type NotificationPreferenceItem,
} from '@/lib/notification';
import type { ApiResponse } from '@/types/api';

// Same endpoints as web notificationService.getPreferences/patchPreference (hs-notification-service via Gateway).
const URL = '/api/v1/notifications/preferences';
type Result = ApiResponse<{ items: NotificationPreferenceItem[] }>;

export async function getNotificationPreferences() {
  return withDefaultPreferences((await axiosClient.get<Result>(URL)).data?.result?.items);
}

export async function patchNotificationPreference(
  category: NotificationCategory,
  channel: 'push' | 'email',
  enabled: boolean
) {
  const response = await axiosClient.patch<Result>(URL, { category, channel, enabled });
  return withDefaultPreferences(response.data?.result?.items);
}
