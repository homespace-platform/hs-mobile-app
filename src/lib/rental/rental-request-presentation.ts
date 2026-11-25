// Port of hs-web-app lib/rental-request-presentation.ts (verbatim; only import paths changed).
import {
  contractStatus,
  paymentStatus,
  requestStatus,
  type Labeled,
  type Role,
} from '@/lib/rental/rental-labels';

/**
 * ONE place that turns a rental request (+ lease contract + live payment status) into the badge and the next hint
 * shown on the list card AND in the detail modal. Pure: no React, no clock.
 *
 * Precedence, first match wins (a later rule never overrides an earlier one):
 *  1. request is closed (REJECTED, EXPIRED, CANCELLED_*) or COMPLETED  -> request status as is. A stale lease contract never revives it.
 *  2. PENDING                                                          -> waiting for the landlord.
 *  3. refund pending (cancelled, tenant must confirm the money back)   -> "Chờ xác nhận hoàn tiền".
 *  4. lease contract ACTIVE                                            -> rented.
 *  5. a transfer was reported and waits for the landlord               -> reported.
 *  6. the last transfer was rejected                                   -> rejected.
 *  7. lease contract in DRAFT / waiting for signatures                 -> contract stage.
 *  8. the reservation payment is confirmed                             -> paid.
 *  9. otherwise                                                        -> waiting for the tenant to pay.
 */
export interface PresentableRequest {
  status: string;
  cancellationRefundPending?: boolean | null;
  initialPayment?: { status?: string | null } | null;
}
export interface PresentationInput {
  role: Role;
  request: PresentableRequest;
  /** Lease contract of the request (not the deposit agreement). */
  contract?: { status?: string | null } | null;
  /** Fresher payment status than the one on the list row (detail modal). */
  livePaymentStatus?: string | null;
  /** `stage` of the onboarding view when it is known. */
  stage?: string | null;
  /** The rejected transfer's deadline has passed (see `transferWindowClosed`): resubmitting is refused by the server. */
  paymentLapsed?: boolean;
}
/** Deposit / first-rent transfers can only be (re)reported before their deadline; afterwards the landlord must reconcile or reopen. */
export function transferWindowClosed(
  payment:
    { type?: string | null; status?: string | null; dueAt?: string | null } | null | undefined,
  nowMs: number
): boolean {
  if (!payment || payment.status !== 'REJECTED' || !payment.dueAt) return false;
  if (payment.type && payment.type !== 'RESERVATION_DEPOSIT' && payment.type !== 'INITIAL')
    return false;
  const due = Date.parse(payment.dueAt);
  return Number.isFinite(due) && nowMs >= due;
}
export interface RequestPresentation extends Labeled {
  /** "closed" = nothing more to do on this request. */
  phase:
    | 'closed'
    | 'pending'
    | 'refund'
    | 'rented'
    | 'reported'
    | 'rejected'
    | 'contract'
    | 'paid'
    | 'unpaid';
  hint: string;
  /** Rejected transfer past its deadline: the tenant cannot resend, the landlord must reconcile or reopen. */
  lapsed?: boolean;
}

const REPORTED_STAGES = ['AWAITING_DEPOSIT_CONFIRMATION', 'AWAITING_RENT_CONFIRMATION'];
const CONTRACT_STAGES = [
  'DRAFT',
  'PENDING_REVIEW',
  'LANDLORD_SIGNATURE_PENDING',
  'TENANT_SIGNATURE_PENDING',
];

export function presentRentalRequest({
  role,
  request,
  contract,
  livePaymentStatus,
  stage,
  paymentLapsed,
}: PresentationInput): RequestPresentation {
  const landlord = role === 'LANDLORD';
  const done = (
    labeled: Labeled,
    phase: RequestPresentation['phase'],
    hint: string
  ): RequestPresentation => ({ ...labeled, phase, hint });
  const status = request.status;

  if (
    [
      'REJECTED',
      'EXPIRED',
      'CANCELLED_BY_RENTER',
      'CANCELLED_BY_OWNER',
      'CANCELLED_BY_SYSTEM',
      'COMPLETED',
    ].includes(status)
  )
    return done(
      requestStatus(status),
      'closed',
      status === 'COMPLETED' ? 'Hợp đồng thuê đã có hiệu lực.' : 'Yêu cầu này đã kết thúc.'
    );

  if (status === 'PENDING')
    return done(
      landlord ? { label: 'Chờ bạn duyệt', tone: 'warning' } : requestStatus('PENDING'),
      'pending',
      landlord
        ? 'Chấp thuận để giữ phòng cho khách, hoặc từ chối.'
        : 'Chờ chủ nhà phản hồi trong thời hạn quy định.'
    );

  if (request.cancellationRefundPending || stage === 'CANCELLATION_REFUND_PENDING')
    return done(
      { label: 'Chờ xác nhận hoàn tiền', tone: 'warning' },
      'refund',
      landlord
        ? 'Chuyển khoản hoàn tiền; người thuê xác nhận khi đã nhận.'
        : 'Xác nhận khi bạn đã nhận lại tiền.'
    );

  if (contract?.status === 'ACTIVE')
    return done(requestStatus('COMPLETED'), 'rented', 'Hợp đồng thuê đang có hiệu lực.');

  const payment = livePaymentStatus || request.initialPayment?.status || undefined;
  if (payment === 'TRANSFER_REPORTED' || (stage && REPORTED_STAGES.includes(stage)))
    return done(
      landlord
        ? { label: 'Khách đã báo chuyển · chờ bạn xác nhận', tone: 'warning' }
        : { ...paymentStatus('TRANSFER_REPORTED'), tone: 'info' },
      'reported',
      landlord
        ? 'Đối chiếu tài khoản trước khi xác nhận đã nhận tiền.'
        : 'Chờ chủ nhà xác nhận đã nhận tiền.'
    );

  if (payment === 'REJECTED' && paymentLapsed)
    return {
      ...done(
        paymentStatus('REJECTED'),
        'rejected',
        landlord
          ? 'Đã quá hạn chuyển khoản. Hãy đối soát và xác nhận đã nhận tiền, hoặc mở lại thanh toán cho người thuê.'
          : 'Đã quá hạn chuyển khoản, chưa thể gửi lại chứng từ. Nếu đã chuyển tiền, hãy nhờ chủ nhà đối soát hoặc mở lại thanh toán.'
      ),
      lapsed: true,
    };

  if (payment === 'REJECTED')
    return done(
      paymentStatus('REJECTED'),
      'rejected',
      landlord ? 'Chờ người thuê gửi lại chứng từ.' : 'Gửi lại chứng từ hoặc chuyển khoản lại.'
    );

  if (contract?.status && CONTRACT_STAGES.includes(contract.status))
    return done(
      contract.status === 'DRAFT'
        ? {
            label: landlord ? 'Bạn đang soạn hợp đồng' : 'Chủ nhà đang soạn hợp đồng',
            tone: 'info',
          }
        : contractStatus(contract.status),
      'contract',
      'Mở hợp đồng để xem và ký khi đủ điều kiện.'
    );

  if (payment === 'CONFIRMED')
    return done(
      { label: 'Đã xác nhận khoản giữ chỗ', tone: 'success' },
      'paid',
      'Theo dõi các bước tiếp theo trong hồ sơ.'
    );

  return done(
    landlord
      ? { label: 'Chờ khách thanh toán', tone: 'warning' }
      : { label: 'Chờ bạn thanh toán', tone: 'warning' },
    'unpaid',
    landlord ? 'Khách cần chuyển khoản giữ chỗ trước hạn.' : 'Chuyển khoản trước hạn để giữ phòng.'
  );
}

/** The single main button of a list card. Decided by role + phase, never by several independent flags. */
export type CardActionKind = 'respond' | 'review' | 'pay' | 'createContract' | 'open';
export function primaryCardAction(
  role: Role,
  p: Pick<RequestPresentation, 'phase' | 'lapsed'>,
  opts: { canCreateContract?: boolean } = {}
): CardActionKind {
  if (role === 'LANDLORD') {
    if (p.phase === 'pending') return 'respond';
    if (p.phase === 'reported') return 'review';
    if (p.phase === 'paid' && opts.canCreateContract) return 'createContract';
    return 'open';
  }
  return p.phase === 'unpaid' || (p.phase === 'rejected' && !p.lapsed) ? 'pay' : 'open';
}

/** Statuses for which polling the contract / list is pointless. */
export const isClosedRequest = (status: string) =>
  [
    'REJECTED',
    'EXPIRED',
    'CANCELLED_BY_RENTER',
    'CANCELLED_BY_OWNER',
    'CANCELLED_BY_SYSTEM',
    'COMPLETED',
  ].includes(status);

export type StepState = 'done' | 'current' | 'upcoming' | 'skipped';
export interface PreTenancyStep {
  id: 'deposit' | 'depositAgreement' | 'firstRent' | 'lease';
  label: string;
  state: StepState;
}

const STAGE_STEP: Record<string, number> = {
  AWAITING_DEPOSIT: 0,
  AWAITING_DEPOSIT_CONFIRMATION: 0,
  AWAITING_DEPOSIT_SIGNATURE: 1,
  WAITING_START: 2,
  AWAITING_FIRST_RENT: 2,
  AWAITING_RENT_CONFIRMATION: 2,
  PREPARING_CONTRACT: 3,
  CONTRACT_TEMPLATE_REQUIRED: 3,
  READY_TO_SIGN: 3,
};
const STEP_LABELS: PreTenancyStep['label'][] = [
  'Cọc giữ chỗ',
  'HĐ cọc',
  'Tiền tháng đầu',
  'HĐ thuê',
];
const STEP_IDS: PreTenancyStep['id'][] = ['deposit', 'depositAgreement', 'firstRent', 'lease'];
const CLOSED_STAGES = [
  'CANCELLATION_REQUESTED',
  'CANCELLATION_REFUND_PENDING',
  'RESOLUTION_PENDING',
  'CANCELLED_BY_SYSTEM',
  'CANCELLED_BY_RENTER',
  'CANCELLED_BY_OWNER',
  'EXPIRED',
  'REJECTED',
  'PENDING',
];

/** The four steps before a tenancy starts, with done/current/upcoming from the server stage (and nextAction when the stage is a review). Null once the path is closed. */
export function preTenancySteps(view: {
  stage: string;
  depositAgreementRequired?: boolean | null;
  nextAction?: { code?: string } | null;
  hasRentPayment?: boolean;
}): PreTenancyStep[] | null {
  if (CLOSED_STAGES.includes(view.stage)) return null;
  let current: number;
  if (view.stage === 'COMPLETED') current = 4;
  else if (view.stage === 'REQUIRES_REVIEW') {
    const code = view.nextAction?.code;
    current = code === 'SIGNING_OVERDUE' ? 3 : view.hasRentPayment ? 2 : 0;
  } else if (view.stage in STAGE_STEP) current = STAGE_STEP[view.stage];
  else return null;
  return STEP_IDS.map((id, i) => ({
    id,
    label: STEP_LABELS[i],
    state:
      i === 1 && view.depositAgreementRequired === false
        ? 'skipped'
        : i < current
          ? 'done'
          : i === current
            ? 'current'
            : 'upcoming',
  }));
}

/** Onboarding stages after which no deadline notice, cancel rule or earlier-start flow applies any more. */
export const isClosedOnboardingStage = (stage: string) =>
  [
    'CANCELLATION_REFUND_PENDING',
    'COMPLETED',
    'CANCELLED_BY_SYSTEM',
    'CANCELLED_BY_RENTER',
    'CANCELLED_BY_OWNER',
    'EXPIRED',
    'REJECTED',
  ].includes(stage);
