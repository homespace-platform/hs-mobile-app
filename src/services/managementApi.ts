import axiosClient from '@/lib/axios-client';
import * as SecureStore from 'expo-secure-store';
import { getAccessToken } from '@/features/auth/session';
import { getUserProfileApi } from '@/services/userApi';
import { onSessionEnd } from '@/lib/session-end';
import type { PageResponse } from '@/types/api';
import type { AppointmentResponse } from '@/types/appointment';

/** These two have their own screen (components/appointment/manage). */
export type AppointmentSection = 'tenant-appointments' | 'landlord-appointments';
export type ManagementSection =
  | AppointmentSection
  | 'tenant-requests'
  | 'landlord-requests'
  | 'tenant-payments'
  | 'landlord-payments'
  | 'landlord-properties'
  | 'landlord-branches'
  | 'landlord-membership'
  | 'tenant-contracts'
  | 'landlord-contracts';
export type Appointment = AppointmentResponse;
/** The fields the attention dot reads from a rental request. */
type RentalRequest = {
  id: string;
  status: string;
  createdAt?: string | null;
  acceptedAt?: string | null;
  updatedAt?: string | null;
};
let managementAttentionCache: Partial<Record<ManagementSection, number>> | null = null;
let managementAttentionCacheAt = 0;
let managementAttentionCacheToken = '';
let managementAttentionRequest: Promise<Partial<Record<ManagementSection, number>>> | null = null;
let managementAttentionRequestToken = '';
let managementAttentionUserId = '';
onSessionEnd(() => {
  managementAttentionCache = null;
  managementAttentionRequest = null;
  managementAttentionCacheToken = '';
  managementAttentionRequestToken = '';
  managementAttentionUserId = '';
});
// shortcut: Seen state is device-local until the API supports per-user read receipts.
const seenNotices = new Map<string, string>();

function appointmentNoticeVersion(row: Appointment, owner: boolean) {
  const incoming = owner
    ? row.status === 'PENDING' ||
      row.rescheduleRequested ||
      (row.status === 'CANCELLED' && row.cancelledBy === 'RENTER')
    : !row.rescheduleRequested &&
      (['CONFIRMED', 'REJECTED', 'COMPLETED'].includes(row.status) ||
        (row.status === 'CANCELLED' && row.cancelledBy === 'OWNER'));
  return incoming ? (row.updatedAt ?? row.createdAt ?? row.status) : null;
}

function rentalNoticeVersion(row: RentalRequest, owner: boolean) {
  if (owner) {
    if (row.status === 'PENDING') return row.createdAt ?? row.status;
    if (row.status === 'CANCELLED_BY_RENTER') return row.updatedAt ?? row.status;
  } else {
    if (row.status === 'ACCEPTED') return row.acceptedAt ?? row.updatedAt ?? row.status;
    if (['REJECTED', 'CANCELLED_BY_OWNER'].includes(row.status)) return row.updatedAt ?? row.status;
  }
  return null;
}

function noticeSeenKey(userId: string, kind: 'appointment' | 'rental', id: string) {
  return `homespace.${kind}Seen.${userId}.${id}`;
}

async function readNoticeSeen(key: string) {
  if (seenNotices.has(key)) return seenNotices.get(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function markNoticeSeen(key: string, version: string | null) {
  if (!version) return false;
  seenNotices.set(key, version);
  managementAttentionCache = null;
  managementAttentionRequest = null;
  try {
    await SecureStore.setItemAsync(key, version);
  } catch {
    // Keep the seen state for this session if secure storage is unavailable.
  }
  return true;
}

export async function markAppointmentNoticeSeen(row: Appointment, owner: boolean, userId: string) {
  return userId
    ? markNoticeSeen(
        noticeSeenKey(userId, 'appointment', row.id),
        appointmentNoticeVersion(row, owner)
      )
    : false;
}

export async function markRentalNoticeSeen(row: RentalRequest, owner: boolean, userId: string) {
  return userId
    ? markNoticeSeen(noticeSeenKey(userId, 'rental', row.id), rentalNoticeVersion(row, owner))
    : false;
}

async function incomingAttentionCount<T extends { id: string }>(
  endpoint: string,
  userId: string,
  kind: 'appointment' | 'rental',
  versionOf: (row: T) => string | null
) {
  if (!userId) return 0;
  let page = 1;
  let count = 0;
  let hasMore: boolean;
  do {
    const response = await axiosClient.get<PageResponse<T>>(endpoint, {
      params: { page, size: 50 },
    });
    const incoming = response.data.result
      .map((row) => ({ row, version: versionOf(row) }))
      .filter((item): item is { row: T; version: string } => item.version !== null);
    const seen = await Promise.all(
      incoming.map((item) => readNoticeSeen(noticeSeenKey(userId, kind, item.row.id)))
    );
    count += incoming.filter((item, index) => seen[index] !== item.version).length;
    hasMore = response.data.hasMore;
    page++;
  } while (hasMore);
  return count;
}

export async function getManagementAttentionCounts(forceRefresh = false) {
  const token = await getAccessToken();
  if (!token) return {};
  if (
    !forceRefresh &&
    managementAttentionCacheToken === token &&
    managementAttentionCache &&
    Date.now() - managementAttentionCacheAt < 30_000
  )
    return managementAttentionCache;
  if (managementAttentionRequest && managementAttentionRequestToken === token)
    return managementAttentionRequest;
  const userId = await getUserProfileApi()
    .then((profile) => profile.id)
    .catch(() => '');
  if (
    !forceRefresh &&
    managementAttentionUserId === userId &&
    managementAttentionCache &&
    Date.now() - managementAttentionCacheAt < 30_000
  ) {
    managementAttentionCacheToken = token;
    return managementAttentionCache;
  }
  if (managementAttentionRequest && managementAttentionRequestToken === token)
    return managementAttentionRequest;
  const request = loadManagementAttentionCounts(userId);
  managementAttentionRequest = request;
  managementAttentionRequestToken = token;
  try {
    const counts = await request;
    if (managementAttentionRequest === request) {
      managementAttentionCache = counts;
      managementAttentionCacheAt = Date.now();
      managementAttentionCacheToken = token;
      managementAttentionUserId = userId;
    }
    return counts;
  } finally {
    if (managementAttentionRequest === request) managementAttentionRequest = null;
  }
}

async function loadManagementAttentionCounts(userId: string) {
  const counts: Partial<Record<ManagementSection, number>> = {};
  const [tenantAppointments, landlordAppointments, tenantRequests, landlordRequests] =
    await Promise.all([
      incomingAttentionCount<Appointment>(
        '/api/v1/appointments/my-bookings',
        userId,
        'appointment',
        (row) => appointmentNoticeVersion(row, false)
      ).catch(() => 0),
      incomingAttentionCount<Appointment>(
        '/api/v1/appointments/owner',
        userId,
        'appointment',
        (row) => appointmentNoticeVersion(row, true)
      ).catch(() => 0),
      incomingAttentionCount<RentalRequest>(
        '/api/v1/rental-requests/my-requests',
        userId,
        'rental',
        (row) => rentalNoticeVersion(row, false)
      ).catch(() => 0),
      incomingAttentionCount<RentalRequest>(
        '/api/v1/rental-requests/owner',
        userId,
        'rental',
        (row) => rentalNoticeVersion(row, true)
      ).catch(() => 0),
    ]);
  counts['tenant-appointments'] = tenantAppointments;
  counts['landlord-appointments'] = landlordAppointments;
  counts['tenant-requests'] = tenantRequests;
  counts['landlord-requests'] = landlordRequests;
  return counts;
}
