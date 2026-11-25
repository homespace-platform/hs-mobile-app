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
  | 'tenant-contracts'
  | 'landlord-contracts';
export type ManagementAction = 'hide' | 'publish' | 'resubmit';
export type ActionOption = {
  action: ManagementAction;
  label: string;
  danger?: boolean;
};
export type ManagementEntry = {
  id: string;
  title: string;
  status: string;
  category?: string;
  date?: string | null;
  listingId?: string;
  fields: [string, string][];
  actions: ActionOption[];
};
export type Appointment = AppointmentResponse;
/** The fields the attention dot reads from a rental request. */
type RentalRequest = {
  id: string;
  status: string;
  createdAt?: string | null;
  acceptedAt?: string | null;
  updatedAt?: string | null;
};
type OwnListing = {
  id: string;
  title: string;
  fullAddress?: string | null;
  priceAmount: number;
  areaM2: number;
  status: string;
  category: string;
  statusReason?: string | null;
  branchName?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
};
function money(value?: number | null) {
  return value == null ? 'Chưa xác định' : `${value.toLocaleString('vi-VN')} đ`;
}
export function statusLabel(status: string) {
  return (
    (
      {
        PENDING: 'Chờ duyệt',
        CONFIRMED: 'Đã xác nhận',
        REJECTED: 'Đã từ chối',
        CANCELLED: 'Đã hủy',
        COMPLETED: 'Hoàn thành',
        EXPIRED: 'Hết hạn',
        ACCEPTED: 'Đã chấp thuận',
        CANCELLED_BY_SYSTEM: 'Hệ thống đã hủy',
        CANCELLED_BY_RENTER: 'Người thuê đã hủy',
        CANCELLED_BY_OWNER: 'Chủ nhà đã hủy',
        PUBLISHED: 'Đang hiển thị',
        HIDDEN: 'Đã ẩn',
        DRAFT: 'Bản nháp',
        PENDING_REVIEW: 'Chờ kiểm duyệt',
        RENTED: 'Đã cho thuê',
        AWAITING_TRANSFER: 'Chờ chuyển khoản',
        TRANSFER_REPORTED: 'Đã báo chuyển khoản',
        OVERDUE: 'Quá hạn',
        UNPAID: 'Chưa thanh toán',
        PAID: 'Đã thanh toán',
        ROLLED_OVER: 'Đã chuyển kỳ',
        LANDLORD_SIGNATURE_PENDING: 'Chờ chủ nhà ký',
        TENANT_SIGNATURE_PENDING: 'Chờ người thuê ký',
        CLOSED: 'Đã kết thúc',
        TERMINATED: 'Đã chấm dứt',
        FAILED: 'Tạo thất bại',
        SIGNED: 'Đã ký',
        ACTIVE: 'Đang hiệu lực',
        SENT: 'Đã gửi',
        READY: 'Sẵn sàng',
      } as Record<string, string>
    )[status] ?? status
  );
}

function listingEntry(row: OwnListing): ManagementEntry {
  return {
    id: row.id,
    title: row.title,
    listingId: row.id,
    status: row.status,
    category: row.category,
    date: row.createdAt,
    fields: [
      ['Địa chỉ', row.fullAddress || '—'],
      ['Giá thuê', money(row.priceAmount)],
      ['Diện tích', `${row.areaM2} m²`],
      ['Chi nhánh', row.branchName || '—'],
      ['Lý do trạng thái', row.statusReason || '—'],
    ],
    actions:
      row.status === 'PUBLISHED'
        ? [{ action: 'hide', label: 'Ẩn tin đăng', danger: true }]
        : ['HIDDEN', 'RENTED_EXTERNALLY'].includes(row.status) &&
            row.expiresAt &&
            new Date(row.expiresAt).getTime() > Date.now()
          ? [{ action: 'publish', label: 'Hiển thị lại tin' }]
          : ['HIDDEN', 'EXPIRED', 'REJECTED'].includes(row.status)
            ? [{ action: 'resubmit', label: 'Gửi duyệt lại tin' }]
            : [],
  };
}
export async function getManagementPage(page: number) {
  const response = await axiosClient.get<PageResponse<OwnListing>>('/api/v1/listings/me', {
    params: { page, size: 12 },
  });
  return {
    items: response.data.result.map(listingEntry),
    hasMore: response.data.hasMore,
    total: response.data.totalElements,
  };
}

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

export async function performManagementAction(entry: ManagementEntry, action: ManagementAction) {
  if (!entry.actions.some((option) => option.action === action))
    throw new Error('Thao tác không khả dụng cho trạng thái hiện tại.');
  await axiosClient.patch(`/api/v1/listings/${encodeURIComponent(entry.id)}/status`, {
    status: action === 'hide' ? 'HIDDEN' : action === 'resubmit' ? 'PENDING_REVIEW' : 'PUBLISHED',
  });
}
