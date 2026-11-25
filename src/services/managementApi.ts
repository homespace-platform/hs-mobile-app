import axiosClient from '@/lib/axios-client';
import * as SecureStore from 'expo-secure-store';
import { getAccessToken } from '@/features/auth/session';
import { getUserProfileApi } from '@/services/userApi';
import type { ApiResponse, PageResponse } from '@/types/api';
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
export const RENTAL_REQUEST_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED_BY_RENTER',
  'CANCELLED_BY_OWNER',
  'CANCELLED_BY_SYSTEM',
] as const;
export type RentalRequestStatus = (typeof RENTAL_REQUEST_STATUSES)[number];
export type ManagementAction =
  | 'reject'
  | 'cancel'
  | 'accept'
  | 'hide'
  | 'publish'
  | 'resubmit'
  | 'confirm-receipt'
  | 'reject-receipt';
export type ActionOption = {
  action: ManagementAction;
  label: string;
  needsReason?: boolean;
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
  rentalRequest?: RentalRequest;
  payment?: Payment;
};
export type Appointment = AppointmentResponse;
export type RentalRequest = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingAddress: string;
  status: string;
  renterName: string;
  renterPhone: string;
  moveInDate: string;
  createdAt?: string | null;
  acceptedAt?: string | null;
  updatedAt?: string | null;
  leaseMonths: number;
  occupantCount: number;
  monthlyRentPrice: number;
  depositAmount?: number | null;
  renterNote?: string | null;
  rejectReason?: string | null;
  holdExpiresAt?: string | null;
  initialPayment?: { status: string } | null;
};
export type Payment = {
  id: string;
  listingId: string;
  rentalRequestId: string;
  contractId?: string;
  invoiceId?: string;
  payerId: string;
  payeeId: string;
  direction: string;
  status: string;
  type: string;
  totalAmount: number;
  transferReference: string;
  dueAt?: string;
  createdAt?: string | null;
  payerReportedAt?: string;
  payeeConfirmedAt?: string;
  confirmedAt?: string;
  updatedAt?: string;
  bankTransactionReference?: string;
  currency?: string;
  lineItems?: {
    id: string;
    displayName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  qrImageUrl?: string;
  payeeBankAccountSnapshot?: BankAccount;
  payeeAccount?: BankAccount;
  rejectedReason?: string;
  evidences?: { storageObjectId: string; note?: string }[];
  evidenceList?: { storageObjectId: string; note?: string }[];
};
export type RentalOnboarding = {
  stage: string;
  message: string;
  cancellationRequestedAt?: string;
  payments: Payment[];
};
type BankAccount = { bankName: string; accountNumber: string; accountHolderName: string };
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
type Branch = {
  id: string;
  name: string;
  category: string;
  display?: string;
  address?: string;
  totalUnits?: number;
  activeListingsCount?: number;
  description?: string;
  createdAt?: string | null;
};
type Contract = {
  id: string;
  listingId: string;
  contractNumber: string;
  status: string;
  paymentStatus: string;
  signedAt?: string;
  createdAt: string;
};
export type ContractDocument = {
  id: string;
  fileName?: string;
  status: string;
  documentType: string;
  viewUrl?: string;
  downloadUrl?: string;
  storageObjectId?: string;
};

export function money(value?: number | null) {
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

export function rentalEntry(row: RentalRequest, owner: boolean): ManagementEntry {
  const actions: ActionOption[] = [];
  if (owner && row.status === 'PENDING')
    actions.push(
      { action: 'accept', label: 'Chấp thuận yêu cầu thuê' },
      { action: 'reject', label: 'Từ chối yêu cầu', needsReason: true, danger: true }
    );
  if (
    row.status === 'PENDING' ||
    (row.status === 'ACCEPTED' &&
      !['TRANSFER_REPORTED', 'CONFIRMED'].includes(row.initialPayment?.status ?? ''))
  )
    actions.push({ action: 'cancel', label: 'Hủy yêu cầu thuê', danger: true });
  return {
    id: row.id,
    title: row.listingTitle,
    listingId: row.listingId,
    status: row.status,
    date: row.createdAt,
    rentalRequest: row,
    actions,
    fields: [
      ['Địa chỉ', row.listingAddress],
      ['Người thuê', row.renterName],
      ['Điện thoại', row.renterPhone],
      ['Ngày vào ở', row.moveInDate],
      ['Thời hạn', `${row.leaseMonths} tháng`],
      ['Số người', `${row.occupantCount}`],
      ['Tiền thuê/tháng', money(row.monthlyRentPrice)],
      ['Tiền cọc', money(row.depositAmount)],
      ['Hạn giữ chỗ', row.holdExpiresAt || '—'],
      ['Ghi chú', row.renterNote || row.rejectReason || '—'],
    ],
  };
}

export function paymentTypeLabel(type: string) {
  return (
    (
      {
        RESERVATION_DEPOSIT: 'Cọc giữ chỗ',
        INITIAL: 'Tiền thuê ban đầu',
        MONTHLY_RENT: 'Tiền thuê định kỳ',
        UTILITY: 'Phí tiện ích',
        OTHER_CHARGE: 'Khoản thu khác',
        INITIAL_PAYMENT_REFUND: 'Hoàn tiền ban đầu',
        DEPOSIT_REFUND: 'Hoàn cọc',
        DEPOSIT_ADJUSTMENT: 'Điều chỉnh cọc',
      } as Record<string, string>
    )[type] ?? type
  );
}

export function paymentEntry(row: Payment, userId: string): ManagementEntry {
  const actions: ActionOption[] = [];
  if (row.payeeId === userId && row.status === 'TRANSFER_REPORTED')
    actions.push(
      { action: 'confirm-receipt', label: 'Xác nhận đã nhận đủ tiền' },
      { action: 'reject-receipt', label: 'Chưa nhận đủ tiền', needsReason: true, danger: true }
    );
  const bank = row.payeeBankAccountSnapshot ?? row.payeeAccount;
  return {
    id: row.id,
    title: `${money(row.totalAmount)} · ${row.transferReference}`,
    listingId: row.listingId,
    status: row.status,
    date: row.createdAt,
    actions,
    payment: { ...row, evidences: row.evidences ?? row.evidenceList ?? [] },
    fields: [
      ['Số tiền', money(row.totalAmount)],
      ['Nội dung chuyển khoản', row.transferReference],
      ['Loại thanh toán', paymentTypeLabel(row.type)],
      ['Chiều chuyển tiền', row.payerId === userId ? 'Bạn chuyển tiền' : 'Bạn nhận tiền'],
      ['Ngày tạo', row.createdAt ? new Date(row.createdAt).toLocaleString('vi-VN') : '—'],
      [
        'Ngày báo chuyển khoản',
        row.payerReportedAt ? new Date(row.payerReportedAt).toLocaleString('vi-VN') : '—',
      ],
      [
        'Ngày xác nhận nhận tiền',
        row.payeeConfirmedAt || row.confirmedAt
          ? new Date((row.payeeConfirmedAt || row.confirmedAt)!).toLocaleString('vi-VN')
          : '—',
      ],
      ['Ngân hàng nhận', bank?.bankName || 'Chưa cấu hình'],
      ['Số tài khoản', bank?.accountNumber || '—'],
      ['Chủ tài khoản', bank?.accountHolderName || '—'],
      ['Hạn thanh toán', row.dueAt ? new Date(row.dueAt).toLocaleString('vi-VN') : '—'],
      ['Mã giao dịch ngân hàng', row.bankTransactionReference || '—'],
      ['Lý do từ chối', row.rejectedReason || '—'],
    ],
  };
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
function branchEntry(row: Branch): ManagementEntry {
  return {
    id: row.id,
    title: row.name,
    status: row.category,
    date: row.createdAt,
    actions: [],
    fields: [
      ['Địa chỉ', row.display || row.address || '—'],
      ['Số phòng', String(row.totalUnits ?? '—')],
      ['Tin đang hoạt động', String(row.activeListingsCount ?? '—')],
      ['Mô tả', row.description || '—'],
    ],
  };
}
function contractEntry(row: Contract): ManagementEntry {
  return {
    id: row.id,
    title: row.contractNumber || row.id,
    listingId: row.listingId,
    status: row.status,
    date: row.createdAt,
    actions: [],
    fields: [
      ['Mã hợp đồng', row.contractNumber],
      ['Thanh toán', statusLabel(row.paymentStatus)],
      ['Ngày tạo', row.createdAt],
      ['Ngày ký', row.signedAt || 'Chưa ký'],
    ],
  };
}

export async function getManagementPage(
  section: Exclude<ManagementSection, AppointmentSection>,
  page: number,
  userId: string,
  rentalStatus?: RentalRequestStatus
) {
  const owner = section.startsWith('landlord-');
  const params = { page, size: 12 };
  if (section.endsWith('-payments')) {
    const response = await axiosClient.get<ApiResponse<Payment[]>>('/api/v1/payment-requests/mine');
    const items = (response.data.result ?? [])
      .filter((row) => {
        const tenantId = row.direction === 'LANDLORD_TO_TENANT' ? row.payeeId : row.payerId;
        return owner
          ? (row.direction === 'LANDLORD_TO_TENANT' ? row.payerId : row.payeeId) === userId
          : tenantId === userId;
      })
      .map((row) => paymentEntry(row, userId));
    return { items, hasMore: false, total: items.length };
  }
  if (section === 'landlord-branches') {
    const response = await axiosClient.get<ApiResponse<Branch[]>>('/api/v1/branches');
    const items = (response.data.result ?? []).map(branchEntry);
    return { items, hasMore: false, total: items.length };
  }
  if (section.endsWith('-requests')) {
    const response = await axiosClient.get<PageResponse<RentalRequest>>(
      `/api/v1/rental-requests/${owner ? 'owner' : 'my-requests'}`,
      { params: { ...params, ...(rentalStatus ? { status: rentalStatus } : {}) } }
    );
    return {
      items: response.data.result.map((row) => rentalEntry(row, owner)),
      hasMore: response.data.hasMore,
      total: response.data.totalElements,
    };
  }
  if (section.endsWith('-contracts')) {
    const response = await axiosClient.get<PageResponse<Contract>>('/api/v1/contracts', {
      params: { ...params, role: owner ? 'LANDLORD' : 'TENANT' },
    });
    return {
      items: response.data.result.map(contractEntry),
      hasMore: response.data.hasMore,
      total: response.data.totalElements,
    };
  }
  const response = await axiosClient.get<PageResponse<OwnListing>>('/api/v1/listings/me', {
    params,
  });
  return {
    items: response.data.result.map(listingEntry),
    hasMore: response.data.hasMore,
    total: response.data.totalElements,
  };
}

export async function getRentalRequestCounts(owner: boolean) {
  const endpoint = `/api/v1/rental-requests/${owner ? 'owner' : 'my-requests'}`;
  const counts = new Map<string, number>();
  let page = 1;
  let hasMore: boolean;
  do {
    const response = await axiosClient.get<PageResponse<RentalRequest>>(endpoint, {
      params: { page, size: 50 },
    });
    for (const row of response.data.result)
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    hasMore = response.data.hasMore;
    page++;
  } while (hasMore);
  return RENTAL_REQUEST_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

let managementAttentionCache: Partial<Record<ManagementSection, number>> | null = null;
let managementAttentionCacheAt = 0;
let managementAttentionCacheToken = '';
let managementAttentionRequest: Promise<Partial<Record<ManagementSection, number>>> | null = null;
let managementAttentionRequestToken = '';
let managementAttentionUserId = '';
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

export async function refreshManagementEntry(
  section: ManagementSection,
  entry: ManagementEntry,
  userId: string
) {
  if (entry.payment) {
    const response = await axiosClient.get<ApiResponse<Payment>>(
      `/api/v1/payment-requests/${encodeURIComponent(entry.id)}`
    );
    return paymentEntry(response.data.result, userId);
  }
  if (section.endsWith('-requests')) {
    const response = await axiosClient.get<ApiResponse<RentalRequest>>(
      `/api/v1/rental-requests/${encodeURIComponent(entry.id)}`
    );
    return rentalEntry(response.data.result, section.startsWith('landlord-'));
  }
  return entry;
}

export async function refreshRentalOnboarding(requestId: string) {
  const response = await axiosClient.post<ApiResponse<RentalOnboarding>>(
    `/api/v1/rental-requests/${encodeURIComponent(requestId)}/onboarding/refresh`
  );
  return response.data.result;
}

export async function performManagementAction(
  section: ManagementSection,
  entry: ManagementEntry,
  action: ManagementAction,
  reason: string
) {
  if (!entry.actions.some((option) => option.action === action))
    throw new Error('Thao tác không khả dụng cho trạng thái hiện tại.');
  if (entry.actions.find((option) => option.action === action)?.needsReason && !reason.trim())
    throw new Error('Vui lòng nhập lý do trước khi tiếp tục.');
  const id = encodeURIComponent(entry.id);
  if (section.endsWith('-requests')) {
    await axiosClient.put(
      `/api/v1/rental-requests/${id}/${action}`,
      action === 'reject' ? { rejectReason: reason.trim() } : undefined
    );
  } else if (section.endsWith('-payments')) {
    await axiosClient.post(
      `/api/v1/payment-requests/${id}/${action}`,
      action === 'confirm-receipt' ? undefined : { reason: reason.trim() }
    );
  } else if (section === 'landlord-properties') {
    await axiosClient.patch(`/api/v1/listings/${id}/status`, {
      status: action === 'hide' ? 'HIDDEN' : action === 'resubmit' ? 'PENDING_REVIEW' : 'PUBLISHED',
    });
  }
}

export async function getContractDocuments(id: string) {
  const response = await axiosClient.get<ApiResponse<ContractDocument[]>>(
    `/api/v1/contracts/${encodeURIComponent(id)}/documents`
  );
  return response.data.result;
}

export async function reportPaymentTransfer(
  payment: Payment,
  proofStorageId: string,
  reference: string
) {
  if (!proofStorageId) throw new Error('Cần tải chứng từ trước khi báo chuyển khoản.');
  await axiosClient.post(
    `/api/v1/payment-requests/${encodeURIComponent(payment.id)}/report-transfer`,
    {
      proofStorageId,
      expectedAmount: payment.totalAmount,
      bankTransactionReference: reference.trim() || undefined,
    }
  );
}
