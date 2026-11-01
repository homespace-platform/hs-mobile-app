import axiosClient from '@/lib/axios-client';
import type { ApiResponse, PageResponse } from '@/types/api';

export type ManagementSection =
  | 'tenant-appointments'
  | 'landlord-appointments'
  | 'tenant-requests'
  | 'landlord-requests'
  | 'tenant-payments'
  | 'landlord-payments'
  | 'landlord-properties'
  | 'landlord-branches'
  | 'tenant-contracts'
  | 'landlord-contracts';
export type AppointmentListFilter = 'ALL' | 'UNVIEWED' | 'COMPLETED';
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
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'complete'
  | 'approve-reschedule'
  | 'reject-reschedule'
  | 'accept'
  | 'hide'
  | 'publish'
  | 'resubmit'
  | 'confirm-receipt'
  | 'reject-receipt'
  | 'dispute';
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
  appointment?: Appointment;
  payment?: Payment;
};
export type Appointment = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingAddress: string;
  status: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  renterName: string;
  renterPhone: string;
  renterNote?: string | null;
  ownerNote?: string | null;
  rejectReason?: string | null;
  cancelReason?: string | null;
  rescheduleRequested: boolean;
  proposedDate?: string | null;
  proposedStartTime?: string | null;
  proposedEndTime?: string | null;
};
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
  payerId: string;
  payeeId: string;
  direction: string;
  status: string;
  type: string;
  totalAmount: number;
  transferReference: string;
  dueAt?: string;
  createdAt?: string | null;
  qrImageUrl?: string;
  payeeBankAccountSnapshot?: BankAccount;
  payeeAccount?: BankAccount;
  rejectedReason?: string;
  evidences?: { storageObjectId: string; note?: string }[];
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
        DISPUTED: 'Đang đối soát',
        OVERDUE: 'Quá hạn',
        SIGNED: 'Đã ký',
        ACTIVE: 'Đang hiệu lực',
        SENT: 'Đã gửi',
        READY: 'Sẵn sàng',
      } as Record<string, string>
    )[status] ?? status
  );
}

export function appointmentEntry(row: Appointment, owner: boolean): ManagementEntry {
  const actions: ActionOption[] = [];
  if (owner && row.status === 'PENDING')
    actions.push(
      { action: 'approve', label: 'Chấp nhận lịch hẹn' },
      { action: 'reject', label: 'Từ chối lịch hẹn', needsReason: true, danger: true }
    );
  if (owner && row.rescheduleRequested && ['PENDING', 'CONFIRMED'].includes(row.status))
    actions.push(
      { action: 'approve-reschedule', label: 'Chấp nhận đổi lịch' },
      { action: 'reject-reschedule', label: 'Từ chối đổi lịch', needsReason: true, danger: true }
    );
  if (owner && row.status === 'CONFIRMED')
    actions.push({ action: 'complete', label: 'Xác nhận đã xem nhà' });
  if (['PENDING', 'CONFIRMED'].includes(row.status))
    actions.push({ action: 'cancel', label: 'Hủy lịch hẹn', needsReason: true, danger: true });
  return {
    id: row.id,
    title: row.listingTitle,
    listingId: row.listingId,
    status: row.status,
    date: row.appointmentDate,
    appointment: row,
    actions,
    fields: [
      ['Địa chỉ', row.listingAddress],
      ['Lịch hẹn', `${row.appointmentDate} · ${row.startTime}–${row.endTime}`],
      ['Người xem', row.renterName],
      ['Điện thoại', row.renterPhone],
      ['Ghi chú', row.renterNote || row.ownerNote || '—'],
      ['Lý do từ chối/hủy', row.rejectReason || row.cancelReason || '—'],
      ...(row.rescheduleRequested
        ? [
            [
              'Lịch đề xuất',
              `${row.proposedDate} · ${row.proposedStartTime}–${row.proposedEndTime}`,
            ] as [string, string],
          ]
        : []),
    ],
  };
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
      !['TRANSFER_REPORTED', 'CONFIRMED', 'DISPUTED'].includes(row.initialPayment?.status ?? ''))
  )
    actions.push({ action: 'cancel', label: 'Hủy yêu cầu thuê', danger: true });
  return {
    id: row.id,
    title: row.listingTitle,
    listingId: row.listingId,
    status: row.status,
    date: row.createdAt,
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

export function paymentEntry(row: Payment, userId: string): ManagementEntry {
  const actions: ActionOption[] = [];
  if (row.payeeId === userId && row.status === 'TRANSFER_REPORTED')
    actions.push(
      { action: 'confirm-receipt', label: 'Xác nhận đã nhận đủ tiền' },
      { action: 'reject-receipt', label: 'Chưa nhận đủ tiền', needsReason: true, danger: true }
    );
  if (
    [row.payerId, row.payeeId].includes(userId) &&
    ['TRANSFER_REPORTED', 'REJECTED'].includes(row.status)
  )
    actions.push({ action: 'dispute', label: 'Yêu cầu đối soát', needsReason: true });
  const bank = row.payeeBankAccountSnapshot ?? row.payeeAccount;
  return {
    id: row.id,
    title: `${money(row.totalAmount)} · ${row.transferReference}`,
    listingId: row.listingId,
    status: row.status,
    date: row.createdAt,
    actions,
    payment: row,
    fields: [
      ['Số tiền', money(row.totalAmount)],
      ['Nội dung chuyển khoản', row.transferReference],
      ['Loại thanh toán', row.type],
      ['Ngân hàng nhận', bank?.bankName || 'Chưa cấu hình'],
      ['Số tài khoản', bank?.accountNumber || '—'],
      ['Chủ tài khoản', bank?.accountHolderName || '—'],
      ['Hạn thanh toán', row.dueAt || '—'],
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
  section: ManagementSection,
  page: number,
  userId: string,
  appointmentFilter: AppointmentListFilter = 'ALL',
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
  if (section.endsWith('-appointments')) {
    if (appointmentFilter === 'UNVIEWED') {
      const items = await getAppointmentsByStatuses(owner, ['PENDING', 'CONFIRMED']);
      return { items, hasMore: false, total: items.length };
    }
    const response = await axiosClient.get<PageResponse<Appointment>>(
      `/api/v1/appointments/${owner ? 'owner' : 'my-bookings'}`,
      {
        params: {
          ...params,
          ...(appointmentFilter === 'COMPLETED' ? { status: 'COMPLETED' } : {}),
        },
      }
    );
    return {
      items: response.data.result.map((row) => appointmentEntry(row, owner)),
      hasMore: response.data.hasMore,
      total: response.data.totalElements,
    };
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
  return Promise.all(
    RENTAL_REQUEST_STATUSES.map(async (status) => {
      const response = await axiosClient.get<PageResponse<RentalRequest>>(endpoint, {
        params: { page: 1, size: 1, status },
      });
      return { status, count: response.data.totalElements };
    })
  );
}

let managementAttentionCache: Partial<Record<ManagementSection, number>> | null = null;
let managementAttentionCacheAt = 0;
let managementAttentionRequest: Promise<Partial<Record<ManagementSection, number>>> | null = null;

export async function getManagementAttentionCounts(forceRefresh = false) {
  if (!forceRefresh && managementAttentionCache && Date.now() - managementAttentionCacheAt < 30_000)
    return managementAttentionCache;
  if (managementAttentionRequest) return managementAttentionRequest;
  managementAttentionRequest = loadManagementAttentionCounts();
  try {
    managementAttentionCache = await managementAttentionRequest;
    managementAttentionCacheAt = Date.now();
    return managementAttentionCache;
  } finally {
    managementAttentionRequest = null;
  }
}

async function loadManagementAttentionCounts() {
  const counts: Partial<Record<ManagementSection, number>> = {};
  const pendingCount = (endpoint: string) =>
    axiosClient
      .get<PageResponse<unknown>>(endpoint, { params: { page: 1, size: 1, status: 'PENDING' } })
      .then((response) => response.data.totalElements)
      .catch(() => 0);
  const [tenantAppointments, landlordAppointments, tenantRequests, landlordRequests, listings] =
    await Promise.all([
      pendingCount('/api/v1/appointments/my-bookings'),
      pendingCount('/api/v1/appointments/owner'),
      pendingCount('/api/v1/rental-requests/my-requests'),
      pendingCount('/api/v1/rental-requests/owner'),
      axiosClient
        .get<ApiResponse<Record<string, number>>>('/api/v1/listings/me/counts')
        .then((response) => response.data.result?.PENDING_REVIEW ?? 0)
        .catch(() => 0),
    ]);
  counts['tenant-appointments'] = tenantAppointments;
  counts['landlord-appointments'] = landlordAppointments;
  counts['tenant-requests'] = tenantRequests;
  counts['landlord-requests'] = landlordRequests;
  counts['landlord-properties'] = listings;
  return counts;
}

export async function getAppointmentCalendar(owner: boolean) {
  return getAppointmentsByStatuses(owner, ['CONFIRMED', 'COMPLETED']);
}

async function getAppointmentsByStatuses(owner: boolean, statuses: string[]) {
  const rows: Appointment[] = [];
  // shortcut: the API only filters a single date; use a date range when the backend supports it.
  for (const status of statuses) {
    let page = 1;
    let hasMore: boolean;
    do {
      const response = await axiosClient.get<PageResponse<Appointment>>(
        `/api/v1/appointments/${owner ? 'owner' : 'my-bookings'}`,
        { params: { status, page, size: 50 } }
      );
      rows.push(...response.data.result);
      hasMore = response.data.hasMore;
      page++;
    } while (hasMore);
  }
  return Array.from(new Map(rows.map((row) => [row.id, row])).values())
    .sort(
      (a, b) =>
        b.appointmentDate.localeCompare(a.appointmentDate) || b.startTime.localeCompare(a.startTime)
    )
    .map((row) => appointmentEntry(row, owner));
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
  if (section.endsWith('-appointments')) {
    const suffix =
      (
        {
          'approve-reschedule': 'reschedule/approve',
          'reject-reschedule': 'reschedule/reject',
          cancel: section.startsWith('landlord-') ? 'owner-cancel' : 'cancel',
        } as Partial<Record<ManagementAction, string>>
      )[action] ?? action;
    await axiosClient.put(`/api/v1/appointments/${id}/${suffix}`, {
      rejectReason: reason.trim(),
      cancelReason: reason.trim(),
    });
  } else if (section.endsWith('-requests')) {
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
