/**
 * Port of the pure part of hs-web-app services/branch-overview.service.ts (design 07, sections 1, 3, 4
 * and 6). The server decides every state, payment order and deadline; these helpers only check the
 * response shape and word it for the screen. Requests: services/branchMonitorApi. Differences from web:
 * Object.hasOwn -> hasOwnProperty.call and a UTC+7 formatter instead of Intl (Hermes).
 */

import { formatDay } from '@/lib/branch-assignment';

const has = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export type RoomStatus =
  | 'VACANT'
  | 'ADVERTISED'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'MOVING_IN'
  | 'EXTERNAL_RENT'
  | 'REPAIR'
  | 'UNLINKED';
export type PaymentStatus =
  'OVERDUE' | 'PENDING_CONFIRMATION' | 'DUE_SOON' | 'NOT_DUE' | 'UNISSUED' | 'PAID' | 'NONE';

export interface OverviewTarget {
  kind: string;
  id: string;
  href: string;
}

export interface OverviewStay {
  tenantName: string | null;
  moveInDate: string;
  target: OverviewTarget;
}

export interface OverviewPayment {
  id: string;
  kind: 'MONTHLY' | 'INITIAL' | 'PROJECTED' | 'SETTLEMENT_BALANCE' | 'DEPOSIT_ADJUSTMENT';
  contractId: string | null;
  status: PaymentStatus;
  dueAt: string;
  confirmationDueAt: string | null;
  clock: 'BILLING' | 'REAL';
  target: OverviewTarget;
}

/** P5. Every date and state is the server's. */
export interface OverviewMeter {
  contractId: string;
  periodIndex: number;
  status: 'TODAY' | 'UPCOMING' | 'RECORDED';
  meterDate: string;
  deadlineAt: string;
  target: OverviewTarget;
}

export interface OverviewExpiry {
  contractId: string;
  status: 'WITHIN_30' | 'WITHIN_60' | 'LONG';
  endDateExclusive: string;
  /** Can be 0 or negative: expired and not handed over yet. */
  daysRemaining: number;
  target: OverviewTarget;
}

export interface OverviewRoom {
  roomId: string;
  status: RoomStatus;
  /** VACANT only: operational status of the target listing. Absent from an older server. */
  listingStatus?: string | null;
  tenantName: string | null;
  target: OverviewTarget | null;
  nextStay: OverviewStay | null;
  payments: { status: PaymentStatus; count: number; items: OverviewPayment[] };
  /** Absent while the server does not have P5 yet; read only after `layerReady`. */
  meters?: OverviewMeter[];
  contracts?: OverviewExpiry[];
}

export interface BranchOverview {
  branchId: string;
  month: string;
  billingNow: string;
  realNow: string;
  rooms: OverviewRoom[];
  unplacedPayments: OverviewPayment[];
}

export type OverviewLayer = 'rooms' | 'payments' | 'meters' | 'contracts';

export const LAYER_LABEL: Record<OverviewLayer, string> = {
  rooms: 'Phòng',
  payments: 'Thu tiền',
  meters: 'Ghi chỉ số',
  contracts: 'Hợp đồng',
};
export const isOverviewLayer = (value: string | null): value is OverviewLayer =>
  value !== null && has(LAYER_LABEL, value);

/* ---------- labels ---------- */

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  VACANT: 'Trống',
  ADVERTISED: 'Đang đăng tin',
  RESERVED: 'Giữ chỗ',
  OCCUPIED: 'Đang thuê',
  MOVING_IN: 'Sắp vào',
  EXTERNAL_RENT: 'Thuê ngoài',
  REPAIR: 'Sửa chữa',
  UNLINKED: 'Chưa gắn tin',
};

/** In legend order: most urgent first. */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  OVERDUE: 'Quá hạn',
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  DUE_SOON: 'Sắp đến hạn / Đang gia hạn',
  NOT_DUE: 'Chưa đến hạn',
  UNISSUED: 'Chưa phát hành',
  PAID: 'Đã thu',
  NONE: 'Không có khoản',
};

const METER_STATUS_LABEL: Record<OverviewMeter['status'] | 'NONE', string> = {
  TODAY: 'Cần ghi hôm nay',
  UPCOMING: 'Sắp đến ngày ghi',
  RECORDED: 'Đã ghi',
  NONE: 'Không có kỳ cần xem',
};

/** NO_LEASE is derived on the client; an older server sends no LONG rows, so an empty list of an occupied room counts as LONG. */
const EXPIRY_STATUS_LABEL: Record<OverviewExpiry['status'] | 'NO_LEASE', string> = {
  WITHIN_30: '≤ 30 ngày',
  WITHIN_60: '31–60 ngày',
  LONG: 'Trên 60 ngày',
  NO_LEASE: 'Không có hợp đồng',
};

/** The last day of a lease is the day before its exclusive end; pure calendar math, so no time zone can move it. */
const lastDay = (endDateExclusive: string) => {
  const [y, m, d] = endDateExclusive.split('-').map(Number);
  return formatDay(new Date(Date.UTC(y, m - 1, d - 1)).toISOString());
};
/** "Còn 13 ngày · hết 09/12/2026", or "Hết hạn 26/11/2026 · chưa bàn giao" once no days are left. */
export const expiryText = (e: Pick<OverviewExpiry, 'endDateExclusive' | 'daysRemaining'>) =>
  e.daysRemaining > 0
    ? `Còn ${e.daysRemaining} ngày · hết ${lastDay(e.endDateExclusive)}`
    : `Hết hạn ${lastDay(e.endDateExclusive)} · chưa bàn giao`;
/** Most urgent (fewest days left) first. */
export const sortExpiries = <T extends Pick<OverviewExpiry, 'daysRemaining'>>(list: T[]) =>
  [...list].sort((a, b) => a.daysRemaining - b.daysRemaining);

/** Keys are in legend order. */
export const LAYER_STATUS_LABEL: Record<OverviewLayer, Record<string, string>> = {
  rooms: ROOM_STATUS_LABEL,
  payments: PAYMENT_STATUS_LABEL,
  meters: METER_STATUS_LABEL,
  contracts: EXPIRY_STATUS_LABEL,
};

const PAYMENT_KIND_LABEL: Record<OverviewPayment['kind'], string> = {
  MONTHLY: 'Hóa đơn tháng',
  INITIAL: 'Khoản thu đầu',
  PROJECTED: 'Kỳ dự kiến',
  SETTLEMENT_BALANCE: 'Quyết toán còn thiếu',
  DEPOSIT_ADJUSTMENT: 'Bù cọc',
};

export const paymentKindLabel = (kind: string) =>
  PAYMENT_KIND_LABEL[kind as OverviewPayment['kind']] ?? 'Khoản thu';
export const statusLabel = (layer: OverviewLayer, status: string) =>
  LAYER_STATUS_LABEL[layer][status] ?? 'Đang cập nhật';
/** The server sorts the lists (contracts: the most urgent lease decides). An empty contracts list comes from an older server, so the room status decides. */
export const roomLayerStatus = (room: OverviewRoom, layer: OverviewLayer): string =>
  layer === 'rooms'
    ? room.status
    : layer === 'payments'
      ? room.payments.status
      : layer === 'meters'
        ? (room.meters?.[0]?.status ?? 'NONE')
        : (sortExpiries(room.contracts ?? [])[0]?.status ??
          (room.status === 'OCCUPIED' ? 'LONG' : 'NO_LEASE'));

/* ---------- links, months, time ---------- */

/** Only paths inside the dashboard are followed; anything else is shown without a link. */
export const targetHref = (target: OverviewTarget | null | undefined) =>
  typeof target?.href === 'string' && target.href.startsWith('/dashboard/') ? target.href : null;

export const isMonth = (value: string | null | undefined): value is string =>
  /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '');

export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number);
  const total = year * 12 + number - 1 + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export const monthLabel = (month: string) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;

const two = (value: number) => String(value).padStart(2, '0');
/** "08:00 27/11/2026" in Vietnam time (fixed UTC+7), as the web's vi-VN formatter prints it. */
export const formatInstant = (value: string) => {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  const date = new Date(time + 7 * 3_600_000);
  return `${two(date.getUTCHours())}:${two(date.getUTCMinutes())} ${two(date.getUTCDate())}/${two(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
};

/**
 * Time until the earliest automatic confirmation, measured from the server's own clock for this payment
 * plus the time passed since the response arrived. null = the server gave no deadline.
 */
export function confirmationCountdown(
  payment: Pick<OverviewPayment, 'confirmationDueAt' | 'clock'>,
  overview: Pick<BranchOverview, 'billingNow' | 'realNow'>,
  elapsedMs: number
): string | null {
  const now = Date.parse(payment.clock === 'BILLING' ? overview.billingNow : overview.realNow);
  const left = Date.parse(payment.confirmationDueAt ?? '') - now - Math.max(0, elapsedMs);
  if (!Number.isFinite(left)) return null;
  if (left <= 0) return 'Đã đến mốc tự xác nhận, chờ cập nhật';
  return `Tự xác nhận sớm nhất sau ${durationText(left)}`;
}

function durationText(ms: number) {
  const minutes = Math.ceil(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days
    ? `${days} ngày ${hours} giờ`
    : hours
      ? `${hours} giờ ${minutes % 60} phút`
      : `${minutes} phút`;
}

/* ---------- search ---------- */

export const foldText = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

/** Substring of the room code, the tenant or the next tenant. */
export function roomMatches(code: string, room: OverviewRoom | undefined, query: string): boolean {
  const needle = foldText(query);
  return [code, room?.tenantName, room?.nextStay?.tenantName].some(
    (text) => !!text && foldText(text).includes(needle)
  );
}

/* ---------- request ---------- */

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null;
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';
/** Nullable fields are always present: null is fine, a missing key is not. */
const orNull = (value: unknown, check: (v: unknown) => boolean) => value === null || check(value);
const isString = (value: unknown) => typeof value === 'string';
const isInstant = (value: unknown) => isText(value) && Number.isFinite(Date.parse(value));
const isKey = (labels: object, value: unknown) => typeof value === 'string' && has(labels, value);

const isTarget = (t: unknown) => isObject(t) && isText(t.kind) && isText(t.id) && isText(t.href);
const isStay = (s: unknown) =>
  isObject(s) && orNull(s.tenantName, isString) && isText(s.moveInDate) && isTarget(s.target);
const isPayment = (p: unknown) =>
  isObject(p) &&
  isText(p.id) &&
  isText(p.kind) &&
  orNull(p.contractId, isString) &&
  isKey(PAYMENT_STATUS_LABEL, p.status) &&
  p.status !== 'NONE' &&
  isInstant(p.dueAt) &&
  orNull(p.confirmationDueAt, isInstant) &&
  (p.clock === 'BILLING' || p.clock === 'REAL') &&
  isTarget(p.target);
const isPayments = (list: unknown): list is Raw[] => Array.isArray(list) && list.every(isPayment);
/** The cell's colour comes from `status`, so it must agree with the list it summarizes. */
const isLayer = (layer: unknown) =>
  isObject(layer) &&
  isPayments(layer.items) &&
  layer.count === layer.items.length &&
  layer.status === (layer.items[0]?.status ?? 'NONE');
const isRoom = (r: unknown) =>
  isObject(r) &&
  isText(r.roomId) &&
  isKey(ROOM_STATUS_LABEL, r.status) &&
  (r.listingStatus === undefined || orNull(r.listingStatus, isString)) &&
  orNull(r.tenantName, isString) &&
  orNull(r.target, isTarget) &&
  orNull(r.nextStay, isStay) &&
  isLayer(r.payments);

const isMeter = (m: unknown) =>
  isObject(m) &&
  isText(m.contractId) &&
  isCount(m.periodIndex) &&
  m.status !== 'NONE' &&
  isKey(METER_STATUS_LABEL, m.status) &&
  isText(m.meterDate) &&
  isInstant(m.deadlineAt) &&
  isTarget(m.target);
const isExpiry = (e: unknown) =>
  isObject(e) &&
  isText(e.contractId) &&
  (e.status === 'WITHIN_30' || e.status === 'WITHIN_60' || e.status === 'LONG') &&
  isText(e.endDateExclusive) &&
  formatDay(e.endDateExclusive) !== '' &&
  Number.isInteger(e.daysRemaining) &&
  isTarget(e.target);

/**
 * The P5 lists are checked per layer, not in `parseOverview`: a server without them, or with a broken one,
 * must not take the room and money layers down.
 */
export function layerReady(overview: Pick<BranchOverview, 'rooms'>, layer: OverviewLayer): boolean {
  if (layer === 'rooms' || layer === 'payments') return true;
  const check = layer === 'meters' ? isMeter : isExpiry;
  return overview.rooms.every((room) => {
    const list: unknown = room[layer];
    return Array.isArray(list) && list.every(check);
  });
}

/** Rejects anything that is not the agreed shape, so the screen falls back to the plain map. */
export function parseOverview(value: unknown): BranchOverview {
  if (
    !isObject(value) ||
    !isText(value.branchId) ||
    !isText(value.month) ||
    !isMonth(value.month) ||
    !isInstant(value.billingNow) ||
    !isInstant(value.realNow) ||
    !Array.isArray(value.rooms) ||
    !value.rooms.every(isRoom) ||
    !isPayments(value.unplacedPayments)
  ) {
    throw new Error('Máy chủ trả về dữ liệu không đúng định dạng.');
  }
  return value as unknown as BranchOverview;
}

/* ---------- "Cần chú ý" (design 07, section 4). Items, order, counts and deadlines are the server's. ---------- */

export type WorkPriority = 'URGENT' | 'SOON' | 'NORMAL';

export interface AttentionWork {
  key: string;
  type: string;
  roomId: string | null;
  roomCode: string | null;
  contextLabel: string | null;
  periodIndex: number | null;
  dueAt: string | null;
  clock: 'BILLING' | 'REAL';
  priority: WorkPriority;
  target: OverviewTarget;
}

export interface BranchAttention {
  branchId: string;
  billingNow: string;
  realNow: string;
  items: AttentionWork[];
  page: number;
  size: number;
  totalElements: number;
}

export interface BranchAttentionCount {
  branchId: string;
  count: number;
}

export interface AttentionSummary {
  /** Server time of this snapshot, comparable with `BranchAttention.realNow`. */
  realNow: string;
  branches: BranchAttentionCount[];
}

export const PRIORITY_LABEL: Record<WorkPriority, string> = {
  URGENT: 'Gấp',
  SOON: 'Sắp tới',
  NORMAL: 'Bình thường',
};

/** [group, label] of each work type. */
const WORK_LABEL: Record<string, [string, string]> = {
  METER_UPCOMING: ['Điện nước', 'Sắp đến ngày ghi'],
  METER_TODAY: ['Điện nước', 'Cần ghi hôm nay'],
  DRAFT_MISSED: ['Điện nước', 'Quá ngày vẫn nháp'],
  METER_AUTOFILLED: ['Điện nước', 'Hóa đơn được tự điền chỉ số'],
  PAYMENT_CONFIRM: ['Tiền', 'Chờ xác nhận tiền'],
  PAYMENT_OVERDUE: ['Tiền', 'Quá hạn thanh toán'],
  PAYMENT_EXTENSION_REQUEST: ['Tiền', 'Xin gia hạn thanh toán'],
  OWNER_REFUND: ['Tiền', 'Chủ nhà cần hoàn tiền'],
  PAYMENT_REVIEW: ['Tiền', 'Đối soát khoản chuyển bị từ chối'],
  CANCELLATION_DECISION: ['Hợp đồng', 'Chờ quyết định hủy trước khi thuê'],
  SIGNING_REOPEN: ['Hợp đồng', 'Quá hạn ký, cần mở lại hạn'],
  OWNER_SIGN: ['Hợp đồng', 'Chờ chủ nhà ký'],
  AMENDMENT_RESPONSE: ['Hợp đồng', 'Phụ lục chờ phản hồi'],
  TERMINATION_RESPONSE: ['Hợp đồng', 'Chấm dứt chờ phản hồi'],
  LEASE_EXPIRING: ['Hợp đồng', 'Hợp đồng sắp hết hạn'],
  RENTAL_REQUEST_PENDING: ['Khách mới', 'Yêu cầu thuê chờ duyệt'],
  VIEWING_PENDING: ['Khách mới', 'Lịch xem chờ duyệt'],
  ROOM_VACANT_UNLISTED: ['Phòng', 'Phòng trống chưa đăng tin'],
  LISTING_REJECTED: ['Phòng', 'Tin bị từ chối'],
  LISTING_EXPIRED: ['Phòng', 'Tin hết hạn'],
  UNPLACED_CONTRACT: ['Dữ liệu', 'Hợp đồng chưa xếp'],
  UNPLACED_LISTING: ['Dữ liệu', 'Tin chưa xếp'],
};

export const workLabel = (type: string): [string, string] =>
  has(WORK_LABEL, type) ? WORK_LABEL[type] : ['Khác', 'Việc cần xem'];

/** Room, contract or listing, and for meter work the cost month of the period. */
export const workContext = (
  work: Pick<AttentionWork, 'roomCode' | 'contextLabel' | 'periodIndex'>
) =>
  [
    work.roomCode ? `Phòng ${work.roomCode}` : null,
    work.contextLabel === work.roomCode ? null : work.contextLabel,
    work.periodIndex === null ? null : `Chi phí tháng ${work.periodIndex + 1}`,
  ]
    .filter(Boolean)
    .join(' · ');

/** Time to the item's deadline on the clock the server named, like `confirmationCountdown`. */
export function workDeadline(
  work: Pick<AttentionWork, 'type' | 'dueAt' | 'clock'>,
  now: Pick<BranchAttention, 'billingNow' | 'realNow'>,
  elapsedMs: number
): string | null {
  if (work.dueAt === null) return null;
  if (work.type === 'PAYMENT_CONFIRM') {
    return confirmationCountdown(
      { confirmationDueAt: work.dueAt, clock: work.clock },
      now,
      elapsedMs
    );
  }
  const left =
    Date.parse(work.dueAt) -
    Date.parse(work.clock === 'BILLING' ? now.billingNow : now.realNow) -
    Math.max(0, elapsedMs);
  if (!Number.isFinite(left)) return null;
  const when = formatInstant(work.dueAt);
  return left > 0 ? `Còn ${durationText(left)} · mốc ${when}` : `Đã qua mốc ${when}`;
}

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
const isWork = (w: unknown) =>
  isObject(w) &&
  isText(w.key) &&
  isText(w.type) &&
  orNull(w.roomId, isString) &&
  orNull(w.roomCode, isString) &&
  orNull(w.contextLabel, isString) &&
  orNull(w.periodIndex, isCount) &&
  orNull(w.dueAt, isInstant) &&
  (w.clock === 'BILLING' || w.clock === 'REAL') &&
  isKey(PRIORITY_LABEL, w.priority) &&
  isTarget(w.target);
const badShape = () => new Error('Máy chủ trả về dữ liệu không đúng định dạng.');

export function parseAttention(value: unknown): BranchAttention {
  if (
    !isObject(value) ||
    !isText(value.branchId) ||
    !isInstant(value.billingNow) ||
    !isInstant(value.realNow) ||
    !Array.isArray(value.items) ||
    !value.items.every(isWork) ||
    !isCount(value.page) ||
    !isCount(value.totalElements) ||
    !isCount(value.size) ||
    (value.size as number) < 1 ||
    (value.size as number) > 100
  ) {
    throw badShape();
  }
  return value as unknown as BranchAttention;
}

export function parseAttentionSummary(value: unknown): AttentionSummary {
  if (
    !isObject(value) ||
    !isInstant(value.realNow) ||
    !Array.isArray(value.branches) ||
    !value.branches.every((b: unknown) => isObject(b) && isText(b.branchId) && isCount(b.count))
  ) {
    throw badShape();
  }
  return value as unknown as AttentionSummary;
}

/** A branch's work count from the newer server snapshot, however late the other answer arrived. */
export function newestCount(
  branchId: string,
  summary: AttentionSummary | null,
  page: Pick<BranchAttention, 'realNow' | 'totalElements'> | undefined
): number | undefined {
  const listed = summary?.branches.find((entry) => entry.branchId === branchId)?.count;
  if (!page) return listed;
  if (!summary || listed === undefined) return page.totalElements;
  return Date.parse(page.realNow) >= Date.parse(summary.realNow) ? page.totalElements : listed;
}

/** Cards in the server's order (most urgent first); branches the summary does not name keep their place at the end. */
export function orderByAttention<T extends { id: string }>(
  branches: T[],
  summary: BranchAttentionCount[] | null
): T[] {
  if (!summary) return branches;
  const rank = new Map(summary.map((entry, index) => [entry.branchId, index]));
  const at = (branch: T) => rank.get(branch.id) ?? summary.length;
  return [...branches].sort((a, b) => at(a) - at(b));
}
