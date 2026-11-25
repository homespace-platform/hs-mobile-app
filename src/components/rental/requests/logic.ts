// Pure decisions of the rental-request screens (no React / React Native): tests/rental-requests.test.cjs.
// Line references are to hs-web-app components/rental-request/* unless another file is named.
import { numberVi } from '@/lib/rental/format';
import { isProfileIncomplete } from '@/lib/profile-gate';
import { canOfferContractFallback } from '@/lib/rental/rental-contract-fallback';
import { canCancelRentalRequest } from '@/lib/rental/rental-request-actions';
import {
  isClosedRequest,
  presentRentalRequest,
  primaryCardAction,
  transferWindowClosed,
} from '@/lib/rental/rental-request-presentation';
import { formatVND } from '@/lib/rental/rental-request.helper';
import { describeNextAction, type DetailTab, type Role } from '@/lib/rental/rental-labels';
import {
  deepLinkLoadError,
  DEEP_LINK_INVALID,
  DEEP_LINK_WRONG_SIDE,
  isRentalRequestId,
  isRequestOnSide,
} from '@/lib/rental/useRentalRequestDeepLink';
import type { createListTickets, RequestFilter } from '@/lib/rental/useRentalRequestList';
import type { NextAction } from '@/services/rental/rental-onboarding.service';
import type { ContractResponse } from '@/types/rental/contract.type';
import type { PaymentRequest } from '@/types/rental/payment-request.type';
import type {
  RentalRequestConflict,
  RentalRequestResponse,
  RentalReviewRow,
} from '@/types/rental/rental-request.type';

export type Mode = 'RECEIVED' | 'SENT';
export const roleOf = (mode: Mode): Role => (mode === 'RECEIVED' ? 'LANDLORD' : 'TENANT');
export const sideOf = (mode: Mode) =>
  mode === 'RECEIVED' ? ('landlord' as const) : ('tenant' as const);

export const validImage = (url?: string | null) => !!url && /^(https?:\/\/|\/)/.test(url.trim());

// --- List page ---

export const LIST_COPY = {
  RECEIVED: {
    title: 'Yêu cầu thuê từ khách',
    description: 'Xét duyệt hồ sơ, theo dõi cọc, tiền tháng đầu và ký hợp đồng khi nhận nhà.',
  },
  SENT: {
    title: 'Yêu cầu thuê tôi đã gửi',
    description:
      'Theo dõi yêu cầu thuê, thanh toán cọc và các bước nhận nhà theo ngày đã thống nhất.',
  },
} as const;

export const STATUS_FILTERS: { key: RequestFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'ACCEPTED', label: 'Đang xử lý thuê' },
  { key: 'COMPLETED', label: 'Đã thuê' },
  { key: 'REJECTED', label: 'Bị từ chối' },
  { key: 'EXPIRED', label: 'Hết hạn' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

export function emptyState(filter: RequestFilter, mode: Mode) {
  if (filter !== 'ALL')
    return {
      title: 'Không có yêu cầu nào ở mục này',
      message: 'Thử chọn mục khác hoặc xem tất cả yêu cầu.',
      action: 'all' as const,
    };
  return {
    title: 'Chưa có yêu cầu nào',
    message:
      mode === 'RECEIVED'
        ? 'Hiện chưa có khách thuê nào gửi yêu cầu thuê nhà đến các bài đăng của bạn.'
        : 'Bạn chưa gửi yêu cầu thuê nhà nào. Hãy khám phá các căn hộ đang cho thuê ngay!',
    action: mode === 'SENT' ? ('browse' as const) : null,
  };
}

type ListTicket = ReturnType<ReturnType<typeof createListTickets>['start']>;

/** One ticketed list load (useRentalRequestList.ts:43-65): only a current result or error reaches the sink. */
export async function runListLoad<T>(
  ticket: ListTicket,
  silent: boolean,
  load: () => Promise<T>,
  sink: { rows: (value: T) => void; failed: () => void; settled: () => void }
) {
  try {
    const next = await load();
    if (!ticket.isCurrent()) return;
    ticket.markApplied();
    sink.rows(next);
  } catch {
    if (!silent && ticket.isCurrent()) sink.failed();
  } finally {
    if (ticket.ownsSpinner()) sink.settled();
  }
}

/** An unchanged page keeps the same array so dependants do not refetch (:57). */
export const keepIfSame = <T>(previous: T, next: T): T =>
  JSON.stringify(previous) === JSON.stringify(next) ? previous : next;

export const needsDeadlinePolling = (requests: Pick<RentalRequestResponse, 'status'>[]) =>
  requests.some((r) => r.status === 'ACCEPTED' || r.status === 'PENDING');

/** RentalRequestsManagement.tsx:133-145 — used only when the conflicts API fails. */
export function localConflicts(
  requests: RentalRequestResponse[]
): Record<string, RentalRequestConflict> {
  const groups = new Map<string, RentalRequestResponse[]>();
  for (const item of requests) {
    if (item.status === 'PENDING')
      groups.set(item.listingId, [...(groups.get(item.listingId) ?? []), item]);
  }
  return Object.fromEntries(
    [...groups]
      .filter(([, rows]) => rows.length >= 2)
      .map(([listingId, rows]) => [
        listingId,
        {
          listingId,
          listingTitle: rows[0].listingTitle,
          listingAddress: rows[0].listingAddress,
          pendingCount: rows.length,
          requestIds: rows.map((row) => row.id),
        },
      ])
  );
}

// --- Contract lookup (useRequestContracts.ts) ---

const LOOKUP_STATUSES = [
  'ACCEPTED',
  'COMPLETED',
  'CANCELLED_BY_SYSTEM',
  'CANCELLED_BY_RENTER',
  'CANCELLED_BY_OWNER',
  'EXPIRED',
];

/** Comma-joined ids: `all` is looked up once per id set, `active` (not closed) is polled. */
export function contractLookupKeys(requests: Pick<RentalRequestResponse, 'id' | 'status'>[]) {
  const wanted = requests.filter((r) => LOOKUP_STATUSES.includes(r.status));
  return {
    all: wanted.map((r) => r.id).join(','),
    active: wanted
      .filter((r) => !isClosedRequest(r.status))
      .map((r) => r.id)
      .join(','),
  };
}

export type ContractMaps = {
  agreements: Record<string, ContractResponse | null>;
  contracts: Record<string, ContractResponse | null>;
};

/** `undefined` = that lookup failed, keep the old value. A deposit agreement is never the lease (:28-35). */
export function mergeContractLookup(
  previous: ContractMaps,
  entries: (readonly [string, ContractResponse | null | undefined])[]
): ContractMaps {
  const agreements = { ...previous.agreements };
  const contracts = { ...previous.contracts };
  for (const [id, agreement] of entries) {
    if (agreement === undefined) continue;
    agreements[id] = agreement;
    contracts[id] = agreement?.agreementKind === 'DEPOSIT' ? null : agreement;
  }
  return { agreements, contracts };
}

// --- Card (RentalRequestCard.tsx:52-60) ---

export const acceptButtonLabel = (holdLabel: string | null) =>
  `Chấp thuận${holdLabel ? ` · giữ chỗ ${holdLabel}` : ' & giữ chỗ'}`;

export function cardState({
  mode,
  request,
  contract,
  conflict,
  nowMs,
}: {
  mode: Mode;
  request: RentalRequestResponse;
  contract?: ContractResponse | null;
  conflict?: RentalRequestConflict;
  nowMs: number;
}) {
  const role = roleOf(mode);
  const presentation = presentRentalRequest({
    role,
    request,
    contract,
    paymentLapsed: transferWindowClosed(request.initialPayment, nowMs),
  });
  const kind = primaryCardAction(role, presentation, {
    canCreateContract: canOfferContractFallback(request, mode, contract),
  });
  // "Mở hồ sơ" goes to the lease contract when there is one, otherwise it opens the request itself.
  const opensContract =
    kind === 'open' &&
    !!contract &&
    (request.status === 'ACCEPTED' || request.status === 'COMPLETED');
  return {
    presentation,
    kind,
    opensContract,
    openLabel: opensContract
      ? contract!.status === 'ACTIVE'
        ? 'Xem hợp đồng hiệu lực'
        : 'Mở hợp đồng'
      : 'Mở hồ sơ',
    payLabel: presentation.phase === 'rejected' ? 'Gửi lại chứng từ' : 'Thanh toán',
    showDetailSecondary: !(kind === 'open' && !opensContract),
    showCancel: canCancelRentalRequest(request, contract, undefined, role),
    showAskAi: mode === 'RECEIVED' && request.status === 'PENDING' && !!conflict,
    showStartChange:
      mode === 'SENT' &&
      request.status === 'ACCEPTED' &&
      !request.cancellationRefundPending &&
      !request.latestStartChange &&
      request.initialPayment?.status === 'CONFIRMED',
  };
}

export const depositPolicyText = (depositAmount: number | null) =>
  depositAmount === 0
    ? 'Không yêu cầu đặt cọc: bỏ qua hợp đồng cọc. Hợp đồng thuê được chuẩn bị khi đến ngày bắt đầu thuê và xác nhận đủ tiền thuê tháng đầu.'
    : 'Hợp đồng cọc có thể xem và ký ngay sau khi xác nhận nhận tiền. Khi hợp đồng thuê được tạo, nút xem sẽ ưu tiên hợp đồng thuê; HĐ cọc vẫn được lưu riêng trong hồ sơ.';

// --- Accept / reject / cancel (RentalRequestDialogs.tsx) ---

export function acceptSummary(request: RentalRequestResponse) {
  const rent = request.effectiveMonthlyRent ?? request.monthlyRentPrice;
  return {
    people: `${request.leaseMonths} tháng · ${request.occupantCount || 1} người`,
    vehicles: `${request.motorbikeCount ? `${request.motorbikeCount} xe máy` : 'Không xe máy'} · ${request.carCount ? `${request.carCount} ô tô` : 'Không ô tô'}`,
    rent: formatVND(rent),
    deposit: request.depositAmount != null ? formatVND(request.depositAmount) : 'Theo tin đăng',
    total: formatVND(rent + (request.depositAmount ?? 0)),
  };
}

/** :72-74 — the landlord has no default receiving account (backend code 7009). */
export function isMissingPayeeAccount(error: unknown) {
  const response = (
    error as
      { response?: { status?: number; data?: { code?: number; message?: string } } } | undefined
  )?.response;
  // 1010 may name the bank account too; the interceptor's own dialog already offers that step.
  if (isProfileIncomplete(response)) return false;
  const body = response?.data;
  const msg = String(body?.message || '');
  return (
    body?.code === 7009 ||
    msg.includes('defaultIncoming') ||
    msg.toLowerCase().includes('tài khoản nhận tiền') ||
    msg.toLowerCase().includes('ngân hàng')
  );
}

/** One decision at a time (:54-59): a second call while one runs is dropped. */
export function createSingleFlight(onBusy: (busy: boolean) => void = () => {}) {
  let locked = false;
  return async (task: () => Promise<void>) => {
    if (locked) return;
    locked = true;
    onBusy(true);
    try {
      await task();
    } finally {
      locked = false;
      onBusy(false);
    }
  };
}

/** RentalRequestsManagement.tsx:109-113. */
export function draftResultNotice(fileState: string) {
  if (fileState === 'UNAVAILABLE' || fileState === 'PENDING')
    return 'Đã có bản nháp nhưng file chưa sẵn sàng. Mở hợp đồng để kiểm tra; không cần tạo lại hay thanh toán thêm.';
  if (fileState === 'INCOMPLETE')
    return 'Đã có bản nháp. Vui lòng bổ sung thông tin bắt buộc trước khi kết xuất và ký.';
  if (fileState === 'EXISTING')
    return 'Hợp đồng đã tồn tại. Mở để tiếp tục theo trạng thái hiện tại.';
  return 'Bản nháp hợp đồng đã sẵn sàng để kiểm tra.';
}

/** The web's toast level for the same result: warning, info or success. */
export function draftResultTone(fileState: string) {
  if (fileState === 'UNAVAILABLE' || fileState === 'PENDING') return 'warning' as const;
  return fileState === 'INCOMPLETE' || fileState === 'EXISTING'
    ? ('info' as const)
    : ('success' as const);
}

// --- Deep link (useRentalRequestDeepLink.ts:60-92) ---

export async function resolveDeepLink(
  rawId: string,
  mode: Mode,
  userId: string,
  getById: (id: string) => Promise<RentalRequestResponse>
): Promise<{ request: RentalRequestResponse } | { notice: string; type: 'info' | 'error' }> {
  if (!isRentalRequestId(rawId)) return { type: 'info', notice: DEEP_LINK_INVALID };
  try {
    const request = await getById(rawId);
    return isRequestOnSide(request, rawId, mode, userId)
      ? { request }
      : { type: 'info', notice: DEEP_LINK_WRONG_SIDE };
  } catch (error) {
    const { type, message } = deepLinkLoadError(error);
    return { type, notice: message };
  }
}

// --- Detail modal (RentalRequestDetailModal.tsx) ---

export const ONBOARDING_STATUSES = [
  'ACCEPTED',
  'COMPLETED',
  'CANCELLED_BY_SYSTEM',
  'CANCELLED_BY_RENTER',
  'CANCELLED_BY_OWNER',
];
export const PANEL_SECTIONS: Record<DetailTab, ('sign' | 'payments' | 'end' | 'history')[]> = {
  overview: [],
  content: [],
  sign: ['sign'],
  payment: ['payments'],
  end: ['end'],
  history: ['history'],
};
export const DETAIL_TAB_IDS: DetailTab[] = ['overview', 'sign', 'payment', 'end', 'history'];

/** Never show a request on the wrong side or for another account, whatever the API returned (:86-89). */
export const isOwnSide = (
  res: Pick<RentalRequestResponse, 'ownerId' | 'renterId'>,
  mode: Mode,
  userId: string | null | undefined
) => !!userId && (mode === 'RECEIVED' ? res.ownerId === userId : res.renterId === userId);

/** :83-84, :113-114 — the first GET and silent refreshes share tickets; only a newer one may apply. */
export function createDetailTickets() {
  let seq = 0;
  let applied = 0;
  return {
    /** A new open invalidates every earlier ticket. */
    open() {
      const ticket = ++seq;
      applied = ticket - 1;
      return ticket;
    },
    next: () => ++seq,
    isNewer: (ticket: number) => ticket > applied,
    apply(ticket: number) {
      applied = ticket;
    },
  };
}

/** :177-187 — which button the next-action card carries. */
export function detailPrimaryAction({
  status,
  mode,
  nextAction,
  tab,
  hasOnboarding,
  phase,
}: {
  status?: string;
  mode: Mode;
  nextAction?: NextAction | null;
  tab: DetailTab;
  hasOnboarding: boolean;
  phase?: string;
}): { kind: 'respond' } | { kind: 'goto'; tab: DetailTab } | { kind: 'pay' } | null {
  if (status === 'PENDING' && mode === 'RECEIVED') return { kind: 'respond' };
  const next = describeNextAction(nextAction, roleOf(mode));
  if (next?.mine && next.tab !== tab) return { kind: 'goto', tab: next.tab };
  if (!hasOnboarding && status === 'ACCEPTED' && mode === 'SENT' && phase === 'unpaid')
    return { kind: 'pay' };
  return null;
}

/** :190-192 */
export function paymentTotals(
  detail: Pick<
    RentalRequestResponse,
    'effectiveMonthlyRent' | 'monthlyRentPrice' | 'depositAmount'
  >,
  payment?: Pick<PaymentRequest, 'lineItems'> | null
) {
  const rentPrice =
    detail.effectiveMonthlyRent != null && detail.effectiveMonthlyRent > 0
      ? detail.effectiveMonthlyRent
      : (detail.monthlyRentPrice ?? 0);
  const prepaidFees =
    payment?.lineItems
      ?.filter((l) => l.type !== 'RENT' && l.type !== 'DEPOSIT')
      .reduce((sum, l) => sum + l.amount, 0) ?? 0;
  return {
    rentPrice,
    prepaidFees,
    upfrontTotal: rentPrice + (detail.depositAmount ?? 0) + prepaidFees,
  };
}

/** :230 */
export const footerContractLabel = (status: string, mode: Mode) =>
  status === 'ACTIVE'
    ? 'Xem hợp đồng hiệu lực'
    : mode === 'RECEIVED'
      ? 'Xem / tiếp tục hợp đồng'
      : status === 'DRAFT'
        ? 'Xem bản nháp hợp đồng'
        : 'Mở hợp đồng';

// --- Viewer identity (features/auth/authSession.ts) ---

/** The `sub` claim of the session's access token; the backend uses it as the profile id. */
export function tokenSubject(token: string | null | undefined): string | null {
  try {
    const payload = token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { sub } = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

// --- AI review (RentalRequestAiReviewModal.tsx) ---

export function aiFacts({ facts }: Pick<RentalReviewRow, 'facts'>) {
  const day = (value: string | null) => {
    if (!value) return 'Chưa rõ';
    const [year, month, date] = value.slice(0, 10).split('-');
    return `${date}/${month}/${year}`;
  };
  const money = (value: number | null) => (value == null ? 'Chưa rõ' : `${numberVi(value)} đ`);
  return [
    facts.leaseMonths != null && `${facts.leaseMonths} tháng`,
    facts.occupantCount != null && `${facts.occupantCount} người`,
    `Dọn vào ${day(facts.moveInDate)}`,
    `Cọc ${money(facts.depositAmount)}`,
  ].filter(Boolean) as string[];
}

export const scorePercent = (score: number) => Math.max(0, Math.min(100, score));

// --- Request form (RentalRequestModal.tsx) ---

/** :123-135 — fields filled from the profile; an empty value leaves the field as it is. */
export function profilePrefill(profile: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username;
  return {
    ...(name ? { renterName: name } : {}),
    ...(profile.phone ? { renterPhone: profile.phone } : {}),
    ...(profile.email ? { renterEmail: profile.email } : {}),
  };
}

export type ContactDraft = { renterName?: string; renterPhone?: string; renterEmail?: string };

/** Web keeps the contact fields while the form is hidden: what is already there beats the profile. */
export const prefillContact = (
  draft: ContactDraft,
  profile: Parameters<typeof profilePrefill>[0]
): ContactDraft => ({ ...profilePrefill(profile), ...draft });

/** One POST per key at a time, also when the form is closed and reopened before it settles. */
export function createSubmitLocks() {
  // A repeated release must never free a newer holder of the same key.
  const pending = new Map<string, () => void>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    has: (listingId: string) => pending.has(listingId),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Returns the release function, or null while this key is already being sent. */
    acquire: (listingId: string) => {
      if (pending.has(listingId)) return null;
      const release = () => {
        if (pending.get(listingId) !== release) return;
        pending.delete(listingId);
        emit();
      };
      pending.set(listingId, release);
      emit();
      return release;
    },
  };
}
export const submitLocks = createSubmitLocks();
/** Per renter and listing: an unsettled POST of one account never locks the next one on the phone. */
export const submitKey = (userId: string | null, listingId: string) =>
  `${userId ?? ''}:${listingId}`;

/** :676-681 — the lease length changes as soon as a positive number is typed. */
export function typedLeaseMonths(text: string) {
  const value = parseInt(text, 10);
  return !isNaN(value) && value > 0 ? value : null;
}

/** :683-686 — on blur the box is restored; the lease length is never raised to the minimum here. */
export const blurredLeaseInput = (
  text: string,
  minimumLeaseMonths: number | undefined,
  leaseMonths: number
) => (!text || parseInt(text, 10) < (minimumLeaseMonths || 1) ? String(leaseMonths) : text);

/** The HTML "valid e-mail address" rule, which is what `type="email"` enforces. */
const HTML_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const MAX_LEASE_MONTHS = 240;

/**
 * What the browser blocks before the web handleSubmit runs (:669-671, :780-783, :1001, :1018, :1034),
 * first invalid field in page order. Run it before validateRentalRequest.
 */
export function inputConstraintError(form: {
  monthsInput: string;
  leaseMonths: number;
  minimumLeaseMonths: number;
  occupantCount: number;
  occupantLimit: number | null;
  renterName: string;
  renterPhone: string;
  renterEmail: string;
}): string | null {
  const minimum = form.minimumLeaseMonths || 1;
  // On web, pressing the button blurs the box first; here the box may still hold the unrestored text.
  const months = blurredLeaseInput(form.monthsInput, form.minimumLeaseMonths, form.leaseMonths);
  // The browser's number input: any HTML floating-point number ("12.0", "12e0") that is whole.
  if (!/^-?(\d+|\d*\.\d+)([eE][-+]?\d+)?$/.test(months) || !Number.isInteger(Number(months)))
    return 'Vui lòng chọn thời hạn thuê hợp lệ';
  if (Number(months) < minimum) return `Thời hạn thuê tối thiểu cho căn này là ${minimum} tháng`;
  if (Number(months) > MAX_LEASE_MONTHS) return `Thời hạn thuê tối đa là ${MAX_LEASE_MONTHS} tháng`;
  const maximum = form.occupantLimit ?? 20;
  if (form.occupantCount > maximum) return `Bài đăng chỉ cho phép tối đa ${maximum} người.`;
  // `required` accepts spaces; the trimmed check stays in validateRentalRequest.
  if (!form.renterName) return 'Vui lòng nhập họ và tên của bạn';
  if (!form.renterPhone) return 'Vui lòng nhập số điện thoại liên hệ';
  const email = form.renterEmail.trim();
  return email && !HTML_EMAIL.test(email) ? 'Địa chỉ email không hợp lệ' : null;
}

/** :1160-1172 — the line above the submit button. */
export function formStatusLine(form: {
  accepted: boolean;
  estimateError: string | null;
  hasEstimate: boolean;
  loadingEstimate: boolean;
}): { text: string; error: boolean } | null {
  if (!form.accepted)
    return {
      text: 'Vui lòng đọc và tích đồng ý điều kiện giữ chỗ để gửi yêu cầu thuê.',
      error: false,
    };
  if (form.estimateError) return { text: 'Chưa thể xác nhận dự toán chi phí.', error: true };
  if (!form.hasEstimate && form.loadingEstimate)
    return { text: 'Đang tính toán dự toán thanh toán...', error: false };
  return null;
}

/** :1185 */
export const submitDisabled = (form: {
  isSubmitting: boolean;
  hasPolicy: boolean;
  accepted: boolean;
  loadingEstimate: boolean;
  estimateError: string | null;
  hasPaymentPlan: boolean;
}) =>
  form.isSubmitting ||
  !form.hasPolicy ||
  !form.accepted ||
  form.loadingEstimate ||
  Boolean(form.estimateError) ||
  !form.hasPaymentPlan;

/** :477-486 — this form reads `message` only, not `errors[]`. */
export function submitErrorMessage(error: unknown) {
  const e = error as { response?: { data?: { message?: string } }; message?: string } | undefined;
  return (
    e?.response?.data?.message ||
    e?.message ||
    'Không thể gửi yêu cầu thuê nhà. Vui lòng kiểm tra lại thông tin.'
  );
}

// --- Listing detail CTA (components/rent/RentDetailView.tsx) ---

/** config/rental-hold.config.ts: hard-coded on web, not read from the policy API. */
export const RENTAL_HOLD_DURATION_LABEL = '60 phút';

/** :431-524 — which block stands where "Yêu cầu thuê nhà" is. */
export function ctaState(activeStatus: string | undefined, listingStatus: string | undefined) {
  if (activeStatus === 'PENDING') return 'pending' as const;
  if (activeStatus === 'ACCEPTED') return 'accepted' as const;
  if (listingStatus === 'RESERVED') return 'reserved' as const;
  return listingStatus === 'PUBLISHED' ? ('request' as const) : ('closed' as const);
}

/**
 * :501-517 and lib/kyc-gate.ts — gates in the web order: owner, permission/profile, then KYC. `guard`
 * shows its own lock message. Signed-out visitors cannot reach this screen on mobile.
 */
export async function runRentalCta({
  isOwner,
  guard,
  checkKyc,
}: {
  isOwner: boolean;
  guard: () => boolean;
  checkKyc: () => Promise<'verified' | 'unverified' | 'unavailable'>;
}): Promise<'owner' | 'locked' | 'verified' | 'unverified' | 'unavailable'> {
  if (isOwner) return 'owner';
  if (!guard()) return 'locked';
  return checkKyc();
}

/** :965-1000 — the props the web passes to RentalRequestModal. */
export function rentalModalProps(property: {
  id: string;
  title: string;
  location: string;
  priceMillion: number;
  depositType?: string;
  depositAmount: number | null;
  depositMonths: number | null;
  images: string[];
  details: Record<string, unknown>;
}) {
  const { details } = property;
  const pricing = details.pricing as Record<string, unknown> | undefined;
  const numeric = (value: unknown) => (typeof value === 'number' ? value : undefined);
  return {
    listingId: property.id,
    listingTitle: property.title,
    listingAddress: property.location,
    listingPrice: property.priceMillion * 1_000_000,
    depositType: (property.depositType || details.depositType || pricing?.depositType) as
      'NONE' | 'FIXED_AMOUNT' | 'MONTH_COUNT' | 'NEGOTIABLE' | undefined,
    listingDepositAmount:
      property.depositAmount ?? numeric(details.depositAmount) ?? numeric(pricing?.depositAmount),
    depositMonths:
      property.depositMonths ?? numeric(details.depositMonths) ?? numeric(pricing?.depositMonths),
    listingThumbnail: property.images[0] || null,
    minimumLeaseMonths: Number(details.minimumLeaseMonths) || 6,
    listingMaxOccupants: numeric(details.maxOccupants) ?? null,
  };
}

export type MarkdownPart = { text: string; bold: boolean; italic?: boolean; href?: string };

export type MarkdownLine = {
  marker: string;
  heading: boolean;
  /** A `>` line. */
  quote?: boolean;
  parts: MarkdownPart[];
  /** A GFM table: rows of cells, the header first. */
  table?: MarkdownPart[][][];
};

/** web AiMarkdownMessage :53 — the only relative link an answer may carry. */
const LISTING_HREF = /^\/rent\/[0-9a-fA-F-]{36}$/;

/** Only http(s) is ever opened; a listing path is opened on the web app when its address is set. */
export function safeLinkTarget(href: string, webBase?: string): string | undefined {
  const url = LISTING_HREF.test(href) && webBase ? `${webBase.replace(/\/+$/, '')}${href}` : href;
  return /^https?:\/\/[^\s<>"'\\]+$/i.test(url) ? url : undefined;
}

const LINK =
  /\[((?:[^[\]]|\[[^[\]]*\])*)\]\(\s*<?((?:[^()\s<>]|\([^()\s<>]*\))*)>?(?:\s+"[^"]*")?\s*\)/;

/** A backtick code span. shortcut: lines are read one by one, so a span cannot cross them. */
const CODE_SPAN = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g;
const HELD = /(\d+)/g;

/**
 * `*x*` and `_x_`. Link targets and bare URLs are matched first so they are left alone, and `_`
 * inside a word is literal. shortcut: no nested or backslash-escaped emphasis.
 */
const ITALIC =
  /(\]\([^()\s]*(?:\([^()\s]*\)[^()\s]*)*(?:\s+"[^"]*")?\)|https?:\/\/[^\s)\]*]+)|\*(?![\s*])([^*]*[^\s*])\*|(^|[^0-9A-Za-zÀ-ỹ_])_(?![\s_])(.*?[^\s_])_(?![0-9A-Za-zÀ-ỹ_])/g;
// Stand-ins for the two toggles, so `**` is out of the way before single `*` are paired.
const BOLD = '\uE001';
const SLANT = '\uE002';

function inlineParts(source: string, webBase?: string): MarkdownPart[] {
  // Code is set aside first, so nothing inside it is read as a link, image or bold.
  const code: string[] = [];
  const pieces = source
    .replace(/[\uE000-\uE002]/g, '')
    .replace(CODE_SPAN, (_, ticks, text: string) => `${code.push(text) - 1}`)
    // Images are not drawn; their alt text stays (also as the label of a linked image).
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`/g, '')
    .replace(/\*\*/g, BOLD)
    .replace(ITALIC, (_, kept?: string, star?: string, before?: string, under?: string) =>
      kept ? kept : `${before ?? ''}${SLANT}${star ?? under}${SLANT}`
    )
    .split(LINK); // text, label, target, text, …
  const parts: MarkdownPart[] = [];
  let bold = false;
  let italic = false;
  const push = (chunk: string, href?: string) =>
    chunk.split(/([\uE001\uE002])/).forEach((held) => {
      if (held === BOLD) bold = !bold;
      else if (held === SLANT) italic = !italic;
      else {
        const text = held.replace(HELD, (_, n) => code[Number(n)]);
        if (text)
          parts.push({ text, bold, ...(italic ? { italic } : {}), ...(href ? { href } : {}) });
      }
    });
  for (let i = 0; i < pieces.length; i += 3) {
    push(pieces[i]);
    if (i + 1 < pieces.length) {
      const target = pieces[i + 2];
      push(pieces[i + 1], target.includes('') ? undefined : safeLinkTarget(target, webBase));
    }
  }
  return parts;
}

function tableCells(row: string) {
  return row
    .replace(/\\\|/g, '\u0000')
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim().split('\u0000').join('|'));
}

const isDelimiterRow = (row: string, columns: number) => {
  if (!row.includes('|')) return false;
  const cells = tableCells(row);
  return cells.length === columns && cells.every((cell) => /^:?-+:?$/.test(cell));
};
/** An opening fence; a backtick one has no further backtick on its line (that is a code span). */
const FENCE = /^(`{3,}(?=[^`]*$)|~{3,})/;
const BLOCK_START = /^(#{1,6}\s|[-*+]\s|\d+\.\s|>|```|~~~)/;

/** The markdown subset AI answers use: lines of plain, bold and link runs, and GFM tables. */
export function markdownLines(content: string, webBase?: string): MarkdownLine[] {
  const rows = content.split('\n').map((raw) => raw.trim());
  const lines: MarkdownLine[] = [];
  let fence = '';
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw) continue;
    if (fence) {
      // Closed by the same character, at least as long and alone on its line; the rest is literal.
      if (raw.startsWith(fence) && raw === fence[0].repeat(raw.length)) fence = '';
      else lines.push({ marker: '', heading: false, parts: [{ text: raw, bold: false }] });
      continue;
    }
    const opening = FENCE.exec(raw);
    if (opening) {
      fence = opening[1];
      continue;
    }
    const header = raw.includes('|') ? tableCells(raw) : null;
    if (header && isDelimiterRow(rows[i + 1] ?? '', header.length)) {
      const body = [header];
      // As in GFM, the table ends at a blank line or at another block; short rows are padded.
      for (i += 2; i < rows.length && rows[i] && !BLOCK_START.test(rows[i]); i++) {
        const cells = tableCells(rows[i]);
        body.push(header.map((_, column) => cells[column] ?? ''));
      }
      i--;
      lines.push({
        marker: '',
        heading: false,
        parts: [],
        // As on web, a <br> inside a cell is a line break.
        table: body.map((cells) =>
          cells.map((cell) => inlineParts(cell.replace(/<br\s*\/?\s*>/gi, '\n'), webBase))
        ),
      });
      continue;
    }
    // shortcut: only lines that start with ">" are quoted (no lazy continuation lines).
    const quote = raw.startsWith('>');
    const body = quote ? raw.replace(/^(>\s*)+/, '') : raw;
    if (!body) continue;
    const bullet = /^[-*+]\s+/.exec(body);
    const numbered = /^(\d+\.)\s+/.exec(body);
    lines.push({
      marker: bullet ? '•' : (numbered?.[1] ?? ''),
      heading: /^#{1,6}\s+/.test(body),
      ...(quote ? { quote } : {}),
      parts: inlineParts(body.replace(/^(#{1,6}|[-*+]|\d+\.)\s+/, ''), webBase),
    });
  }
  return lines;
}
