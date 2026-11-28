// Pure decisions of the billing screens, cut out of the web components (file:line noted on each).
// No React Native imports: tests/rental-billing.test.cjs runs them, several against the web source.
import { PAGE_SIZE } from '@/lib/pagination';
import { formatNumberVi } from '@/lib/rent-detail';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { numberVi, currencyVnd, roundDecimal } from '@/lib/rental/format';
import { findInvoicePayment } from '@/lib/rental/invoice-list';
import {
  dateTime,
  dueCountdown,
  invoiceDraftPayload,
  type Extra,
} from '@/lib/rental/MonthlyInvoicesSection';
import { chooseInvoice } from '@/lib/rental/payment-module';
import { splitSentences } from '@/lib/rental/split-sentences';
import type { ComplaintCase } from '@/types/rental/complaint.type';
import type { ContractLifecycle, ClosureDeduction } from '@/types/rental/contract-lifecycle.type';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';
import type { PaymentRequest, ReportTransferPayload } from '@/types/rental/payment-request.type';
import type { LocalFile } from '@/services/storageApi';

// --- locks and reads ---

/** One action at a time (web `useRef` mutex): a second call while one runs does nothing. */
export function createActionLock() {
  let held = false;
  return {
    get held() {
      return held;
    },
    async run(action: () => Promise<unknown>) {
      if (held) return false;
      held = true;
      try {
        await action();
      } finally {
        held = false;
      }
      return true;
    },
  };
}

/**
 * MIS:99-145: one read at a time. A request made meanwhile marks it dirty and gets exactly one
 * follow-up; the returned promise covers that follow-up. `read` handles its own errors.
 * While `isVisible` is false no follow-up starts: the caller must read again on return.
 */
export function createSingleFlight(
  read: () => Promise<void>,
  isAlive: () => boolean,
  isVisible: () => boolean = () => true
) {
  let inflight: Promise<void> | null = null;
  let dirty = false;
  return (): Promise<void> => {
    if (!isAlive()) return Promise.resolve();
    if (inflight) {
      dirty = true;
      return inflight;
    }
    let done = false;
    const run = (async () => {
      try {
        do {
          dirty = false;
          await read();
        } while (dirty && isAlive() && isVisible());
      } finally {
        done = true;
        inflight = null;
      }
    })();
    if (!done) inflight = run;
    return run;
  };
}

// --- payments: proof report and receipt review ---

export const PROOF_MAX_BYTES = 15 * 1024 * 1024;
export const TRANSFERABLE = ['AWAITING_TRANSFER', 'OVERDUE', 'REJECTED'];
export const PAYMENT_CHANGED = 'Khoản chuyển khoản đã thay đổi; hãy tải lại.';
export const AMOUNT_CHANGED =
  'Số tiền hóa đơn đã thay đổi. Vui lòng kiểm tra lại QR và số tiền trước khi báo chuyển khoản.';

type TransferDetails = Pick<
  PaymentRequest,
  'id' | 'totalAmount' | 'payeeId' | 'payeeBankAccountSnapshot' | 'transferReference'
>;
type TransferSnapshot = TransferDetails & Pick<PaymentRequest, 'payerId' | 'direction' | 'status'>;

/** What the payer was told to transfer: payment, amount, payee and transfer content. */
export const transferStamp = (p: TransferDetails) => {
  const bank = p.payeeBankAccountSnapshot;
  return JSON.stringify([
    p.id,
    p.totalAmount,
    p.payeeId,
    bank?.bankBin,
    bank?.bankCode,
    bank?.accountNumber,
    bank?.accountHolderName,
    p.transferReference,
  ]);
};

/** A chosen proof with the transfer data on screen when its picker was opened. */
export type BoundProof = { file: LocalFile; stamp: string };
export const PROOF_STALE = 'Thông tin khoản chuyển đã thay đổi. Vui lòng chọn lại chứng từ.';
export const bindProof = (file: LocalFile | undefined, payment: TransferDetails) =>
  file && { file, stamp: transferStamp(payment) };
/** The file that may be shown and sent for `payment`; undefined once its transfer data changed. */
export const proofFor = (proof: BoundProof | undefined, payment: TransferDetails) =>
  proof && proof.stamp === transferStamp(payment) ? proof.file : undefined;

/** SPP:39-41 plus payee account and transfer content: what is reported is still what is on screen. */
export const sameTransfer = (shown: TransferSnapshot, current: TransferSnapshot) =>
  transferStamp(current) === transferStamp(shown) &&
  current.payerId === shown.payerId &&
  current.direction === shown.direction &&
  TRANSFERABLE.includes(current.status);

/** What the payee looked at: one particular report of one particular payment. */
export const reviewStamp = (
  p: Pick<PaymentRequest, 'id' | 'status' | 'totalAmount' | 'payerReportedAt' | 'evidences'>
) =>
  [
    p.id,
    p.status,
    p.totalAmount,
    p.payerReportedAt ?? '',
    ...(p.evidences ?? []).map((e) => e.id).sort(),
  ].join('|');

/**
 * Stricter than web (RB-03 class): confirm-receipt / reject-receipt only take the payment id, so the
 * payment is read again and the decision is dropped when it is no longer the report that was reviewed.
 */
export async function assertSameReview(
  reviewed: PaymentRequest,
  read: (id: string) => Promise<PaymentRequest>
) {
  if (reviewStamp(await read(reviewed.id)) !== reviewStamp(reviewed))
    throw new Error(PAYMENT_CHANGED);
}

export const PROOF_NOT_RECORDED =
  'Máy chủ không ghi nhận tệp vừa gửi cho khoản chuyển này. Hãy xem chứng từ đã được ghi nhận trước khi thao tác tiếp.';

export type ProofDeps = {
  read: (id: string) => Promise<PaymentRequest>;
  upload: (paymentId: string) => Promise<string>;
  report: (
    id: string,
    payload: ReportTransferPayload
  ) => Promise<Pick<PaymentRequest, 'evidences'>>;
  isAlive: () => boolean;
};

/**
 * RD-11: the server answers success for a payment already reported, keeping the other report's file,
 * so a report counts only when the answer holds this upload.
 */
export function assertProofRecorded(
  reported: Pick<PaymentRequest, 'evidences'>,
  storageId: string
) {
  if (!reported.evidences?.some((e) => e.storageObjectId === storageId))
    throw new Error(PROOF_NOT_RECORDED);
}

/**
 * Upload the proof of exactly `shown` and report exactly its amount (MIS:262-266, SPP:37-45).
 * False when the screen was left before the report was sent. Throws when the answer does not hold this
 * upload: the server answers success for a payment already reported, keeping the other report's file.
 */
export async function sendTransferProof(shown: PaymentRequest, deps: ProofDeps) {
  const storageId = await deps.upload(shown.id);
  if (!deps.isAlive()) return false;
  const reported = await deps.report(shown.id, {
    proofStorageId: storageId,
    expectedAmount: shown.totalAmount,
  });
  assertProofRecorded(reported, storageId);
  return true;
}

/** MIS:247-260: why the invoice proof must not be sent, or null. */
export async function invoiceReportBlock(
  shown: PaymentRequest,
  file: { sizeBytes: number } | undefined,
  read: ProofDeps['read']
): Promise<{ message: string; refresh: boolean } | null> {
  if (!file) return { message: 'Vui lòng chọn chứng từ chuyển khoản.', refresh: false };
  if (file.sizeBytes > PROOF_MAX_BYTES)
    return { message: 'Chứng từ tối đa 15 MB.', refresh: false };
  try {
    const current = await read(shown.id);
    if (current.totalAmount !== shown.totalAmount)
      return { message: AMOUNT_CHANGED, refresh: true };
    // Stricter than web MIS (SPP has this check): another payment or one no longer awaiting money.
    if (!sameTransfer(shown, current)) return { message: PAYMENT_CHANGED, refresh: true };
  } catch (error) {
    return {
      message: getApiErrorMessage(error, 'Không thể kiểm tra số tiền mới nhất.'),
      refresh: false,
    };
  }
  return null;
}

/** SPP:34-45 as the action run under the panel's lock. */
export async function sendSettlementProof(shown: PaymentRequest, deps: ProofDeps) {
  const current = await deps.read(shown.id);
  if (!deps.isAlive()) return;
  if (!sameTransfer(shown, current)) throw new Error(PAYMENT_CHANGED);
  await sendTransferProof(shown, deps);
}

// --- monthly invoices (MIS) ---

/** MIS:291-292. */
export const outstandingTotal = (invoices: Pick<MonthlyInvoice, 'status' | 'totalAmount'>[]) =>
  invoices
    .filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + i.totalAmount, 0);

/** MIS:293-298: what is listed and which invoice is open; never another one than the one asked for. */
export function invoiceSelection(input: {
  invoices: MonthlyInvoice[];
  payments: PaymentRequest[];
  isLandlord: boolean;
  selectedInvoiceId: string | null;
  requestedInvoiceId?: string | null;
  invalidInvoiceRequest?: string | null;
}) {
  const { invoices, payments, isLandlord, requestedInvoiceId, invalidInvoiceRequest } = input;
  // A tenant never sees drafts.
  const shown = isLandlord ? invoices : invoices.filter((bill) => bill.status !== 'DRAFT');
  const known = (id?: string | null) => !!id && shown.some((bill) => bill.id === id);
  const manual = known(input.selectedInvoiceId) ? input.selectedInvoiceId : null;
  const requestMissing =
    !manual && (!!invalidInvoiceRequest || (!!requestedInvoiceId && !known(requestedInvoiceId)));
  const selected = requestMissing
    ? undefined
    : chooseInvoice(
        shown,
        payments,
        isLandlord ? 'landlord' : 'tenant',
        manual ?? requestedInvoiceId
      );
  return {
    shown,
    ordered: [...shown].sort((a, b) => b.periodIndex - a.periodIndex),
    requestMissing,
    selected,
  };
}

export const paymentOfInvoice = findInvoicePayment;

/** MIS:335-336: from 00:00 (+07) of the period's last day. */
export const canIssueNow = (invoice: Pick<MonthlyInvoice, 'serverNow' | 'periodEndExclusive'>) =>
  new Date(invoice.serverNow).getTime() >=
  new Date(`${invoice.periodEndExclusive}T00:00:00+07:00`).getTime() - 86_400_000;

/** MIS:337-361 and :379: the status sentence(s) of an invoice. */
export function invoiceMessage(invoice: MonthlyInvoice, paymentStatus?: string) {
  const firstRent = invoice.billingPeriod?.kind === 'INITIAL_RENT';
  const notice = invoice.unilateralTermination?.status;
  const messages: Record<MonthlyInvoice['workflowState'], string> = {
    CANCELLED: firstRent
      ? 'Khoản tiền thuê này đã hủy / hết hạn. Kiểm tra nghĩa vụ hoàn tiền ở mục Cọc & hoàn cọc.'
      : 'Bản nháp hóa đơn đã hủy khi kết thúc hợp đồng, không tạo thêm khoản phải thanh toán.',
    UPCOMING: 'Kỳ thuê chưa đến ngày chốt chỉ số.',
    METER_REQUIRED: `Chủ nhà cần lưu chỉ số và phí phát sinh trước ${dateTime(invoice.meterDeadlineAt)}.`,
    READY_FOR_ISSUE: `Đã lưu bản nháp. Bạn có thể chốt và phát hành ngay; nếu không, hệ thống tự phát hành từ ${dateTime(invoice.meterDeadlineAt)}.`,
    METER_DEADLINE_MISSED:
      'Đã hết 24 giờ nhập chỉ số. Hệ thống sẽ tạm điền chỉ số cũ cho phần còn thiếu và phát hành; nếu thiếu chỉ số đầu hoặc biểu phí hợp lệ, cần bổ sung dữ liệu.',
    EXTENSION_PENDING:
      'Đang chờ chủ nhà duyệt yêu cầu dời hạn thanh toán. Phí phạt tạm dừng; nếu từ chối hoặc hết hạn phản hồi, phí sẽ được tính bù.',
    PAYMENT_EXTENDED: invoice.lateFeeExempt
      ? 'Đã dời hạn thanh toán theo quyết định cũ miễn tăng phí cho hóa đơn này.'
      : 'Đã dời hạn thanh toán. Trong hạn mới không tăng phí; nếu vẫn trả trễ, phí tiếp tục theo hợp đồng và giới hạn của hóa đơn.',
    UNPAID: 'Hóa đơn đã phát hành, đang chờ người thuê thanh toán.',
    PAYMENT_REMINDER:
      'Sắp đến hạn thanh toán. Người thuê vui lòng kiểm tra số tiền và chuyển khoản.',
    OVERDUE: invoice.lateFeeExempt
      ? 'Đã trễ hạn. Quyết định dời hạn cũ miễn tăng phí vẫn được giữ; nghĩa vụ thanh toán còn tồn tại.'
      : 'Hóa đơn quá hạn, kể cả sau khi dời hạn. Phí theo hợp đồng tiếp tục cộng trong giới hạn của hóa đơn và cập nhật trên QR.',
    OVERDUE_ACTION_REQUIRED:
      notice === 'ENDED'
        ? 'Hợp đồng đã chấm dứt theo quyết định đơn phương. Công nợ hóa đơn vẫn cần thanh toán; bàn giao được xác nhận riêng.'
        : notice === 'NOTICE'
          ? 'Đã thông báo đơn phương chấm dứt. Người thuê có 24 giờ khiếu nại xin đổi phương án; xem thời hạn cụ thể bên dưới.'
          : notice === 'REVIEW_REQUESTED'
            ? 'Đã nhận khiếu nại đúng hạn, đang chờ chủ nhà quyết định. Tự chấm dứt đang tạm dừng.'
            : 'Đã quá hạn 5 ngày: chủ nhà cần ghi nhận phương án xử lý bên dưới.',
    UNDER_REVIEW:
      paymentStatus === 'TRANSFER_REPORTED'
        ? 'Đã báo chuyển và gửi chứng từ, đang chờ chủ nhà xác nhận nhận tiền. Phí phạt tạm dừng tăng trong lúc chờ xử lý.'
        : 'Khoản thanh toán đang chờ xác nhận; phí phạt tạm dừng tăng trong lúc chờ xử lý.',
    PAID: 'Đã xác nhận thanh toán.',
    DEFERRED: `${invoice.overdueActions.some((a) => a.type === 'AUTOMATIC_ROLLOVER') ? 'Hệ thống đã tự chốt công nợ sau 10 ngày quá hạn' : 'Chủ nhà đã cho phép cộng dồn khoản nợ này'} để cộng vào hóa đơn kỳ kế tiếp. Phí phạt đã dừng tăng; bạn vẫn có thể thanh toán hóa đơn này trước khi chuyển nợ.`,
    ROLLED_OVER:
      'Khoản nợ đã được cộng vào hóa đơn kỳ kế tiếp. QR của hóa đơn này đã hủy; vui lòng thanh toán theo hóa đơn mới.',
  };
  const text = String(
    firstRent
      ? invoice.status === 'PAID'
        ? 'Đã xác nhận tiền thuê tháng 1. Không thu lại trong các kỳ sau; cọc theo dõi riêng.'
        : invoice.status === 'CANCELLED'
          ? messages.CANCELLED
          : 'Tiền thuê tháng đầu được mở theo tiến trình nhận nhà. Quá hạn cần đối soát, không áp dụng cộng dồn nợ hay phạt của kỳ thuê đang có hiệu lực.'
      : messages[invoice.workflowState]
  );
  const sentences = splitSentences(text);
  return {
    text,
    warn: ['OVERDUE', 'OVERDUE_ACTION_REQUIRED', 'METER_DEADLINE_MISSED'].includes(
      invoice.workflowState
    ),
    /** Set when web folds the message into a PolicyNotice; it is the summary row. */
    summary: sentences.length > 1 || text.length > 120 ? sentences[0] : null,
  };
}

/** MIS:362-477: which blocks of one invoice card are shown. */
export function invoiceCardState(
  invoice: MonthlyInvoice,
  payment: PaymentRequest | undefined,
  { isLandlord, isTenant }: { isLandlord: boolean; isTenant: boolean }
) {
  const firstRent = invoice.billingPeriod?.kind === 'INITIAL_RENT';
  const issued = invoice.status !== 'DRAFT';
  const showTransfer =
    issued && !!payment && !['PAID', 'ROLLED_OVER', 'CANCELLED'].includes(invoice.status);
  const payerTurn = showTransfer && isTenant && TRANSFERABLE.includes(payment!.status);
  return {
    firstRent,
    countdown: !['DRAFT', 'PAID', 'ROLLED_OVER', 'CANCELLED'].includes(invoice.status)
      ? dueCountdown(invoice.dueAt, invoice.serverNow)
      : null,
    showTotal: issued,
    showLateRule:
      !firstRent &&
      ['UNPAID', 'PAYMENT_REMINDER', 'OVERDUE', 'OVERDUE_ACTION_REQUIRED'].includes(
        invoice.workflowState
      ),
    showDraftForm: invoice.status === 'DRAFT' && isLandlord,
    showLines: issued,
    showLateFee: issued && invoice.lateFeeAmount > 0 && invoice.status !== 'ROLLED_OVER',
    showResolutionPanels: issued && !firstRent,
    showOriginalAmount:
      issued && firstRent && !!payment && payment.totalAmount !== invoice.totalAmount,
    showOriginalProof: issued && firstRent && !!payment && invoice.status === 'PAID',
    showTransfer,
    showQr: payerTurn && !!payment!.qrImageUrl,
    showReport:
      payerTurn &&
      // First-month rent stops taking proofs at its due time (server clock).
      (!firstRent || !payment!.dueAt || new Date(invoice.serverNow) < new Date(payment!.dueAt)),
    showDecision: showTransfer && isLandlord && payment!.status === 'TRANSFER_REPORTED',
    showReceipt: payment?.status === 'CONFIRMED' && payment.totalAmount > 0,
  };
}

/** "12." is 12; a lone "." is nothing (web type=number never yields it). */
export const readingText = (text: string | undefined) => {
  const value = (text ?? '').trim().replace(',', '.');
  if (!value) return '';
  return Number.isFinite(Number(value)) ? String(Number(value)) : '';
};

/** MIS:206-229 on what the user typed (a vi-VN "," is a decimal point). */
export function draftPayload(
  input: Omit<Parameters<typeof invoiceDraftPayload>[0], 'electricityText' | 'waterText'> & {
    electricityText?: string;
    waterText?: string;
    extras?: Extra[];
  }
) {
  return invoiceDraftPayload({
    ...input,
    electricityText: readingText(input.electricityText),
    waterText: readingText(input.waterText),
  });
}

// --- payment extension (PEP) ---

/** PEP:28-34. */
export function extensionState(invoice: MonthlyInvoice, isLandlord: boolean, isTenant: boolean) {
  const history = invoice.paymentExtensions || [];
  const pending = history.find((r) => r.status === 'PENDING');
  const approved = [...history].reverse().find((r) => r.status === 'APPROVED');
  const canRequest = isTenant && invoice.canRequestExtension;
  const canDirect = isLandlord && invoice.canResolveOverdue && !pending;
  return {
    history,
    pending,
    approved,
    resumedFees:
      approved?.lateFeeResumesAfterDue === true && approved.newDueAt === invoice.dueAt
        ? approved
        : undefined,
    canRequest,
    canDirect,
    canDecide:
      !!pending &&
      isLandlord &&
      invoice.workflowState !== 'UNDER_REVIEW' &&
      invoice.activeResolution === 'EXTENSION_REQUEST',
    visible: canRequest || canDirect || history.length > 0,
  };
}

export const daysValid = (days: number) => Number.isInteger(days) && days >= 1 && days <= 30;
// What a web type=number field hands to Number(): HTML's "valid floating-point number".
const HTML_NUMBER = /^-?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;
/** A days field as typed, read as web reads it; any other text is NaN, never a trimmed or cut value. */
export const parseDays = (text: string) => (HTML_NUMBER.test(text) ? Number(text) : NaN);
export const noteValid = (text: string) => text.trim().length >= 10 && text.trim().length <= 1000;
export const EXTENSION_INVALID = 'Chọn 1–30 ngày và nhập lý do từ 10 đến 1000 ký tự.';

// --- overdue actions, legacy termination (OAP) ---

/** OAP:41-46, :109-149. */
export function overdueState(
  invoice: MonthlyInvoice,
  {
    contractActive,
    isLandlord,
    isTenant,
  }: { contractActive: boolean; isLandlord: boolean; isTenant: boolean }
) {
  const history = invoice.overdueActions || [];
  const canRecord =
    contractActive &&
    isLandlord &&
    invoice.canResolveOverdue &&
    !invoice.deferredAt &&
    (!invoice.terminationProposedAt ||
      !!invoice.terminationDeclinedAt ||
      !!invoice.terminationCancelledAt);
  // Only records the server already has: nothing here can start a legacy proposal (WD-6).
  const isTerminationInvoice =
    invoice.terminationProposalInvoiceId === invoice.id && !invoice.unilateralTermination;
  const declined = !!invoice.terminationDeclinedAt;
  const accepted = !!invoice.terminationAcceptedAt;
  const cancelled = !!invoice.terminationCancelledAt;
  const open =
    isTerminationInvoice && !!invoice.terminationProposedAt && !invoice.terminationCompletedAt;
  return {
    history,
    visible:
      canRecord || history.length > 0 || isTerminationInvoice || !!invoice.unilateralTermination,
    canDefer: canRecord && invoice.canDeferToNextPeriod,
    cannotDefer: canRecord && !invoice.canDeferToNextPeriod,
    canPropose: canRecord && (!isTerminationInvoice || cancelled),
    legacy: {
      open,
      tenantRespond: open && contractActive && isTenant && !accepted && !declined && !cancelled,
      landlordWithdraw: open && contractActive && isLandlord && !accepted && !cancelled,
      force:
        open && contractActive && isLandlord && declined && !cancelled && !invoice.deferredAt
          ? invoice.landlordTerminationClauseSigned
            ? ('form' as const)
            : ('clause-missing' as const)
          : null,
      acceptedNote: open && accepted && !cancelled,
      complete: open && contractActive && isLandlord && accepted && !cancelled,
      completed: isTerminationInvoice && !!invoice.terminationCompletedAt,
    },
  };
}

// --- unilateral termination (UTP) ---

/** UTP:34-35, :61-96. */
export function unilateralState(
  invoice: MonthlyInvoice,
  { isLandlord, isTenant, canIssue }: { isLandlord: boolean; isTenant: boolean; canIssue: boolean }
) {
  const notice = invoice.unilateralTermination;
  const waiting = notice?.status === 'NOTICE' || notice?.status === 'REVIEW_REQUESTED';
  return {
    notice,
    visible: (isLandlord || isTenant) && (!!notice || canIssue),
    issueForm: isLandlord && canIssue,
    reviewForm: isTenant && !!notice && !!invoice.canRequestTerminationReview,
    decisionForm: isLandlord && !!notice && !!invoice.canDecideTerminationReview,
    withdraw: isLandlord && waiting,
    handover: isLandlord && !!notice && !!invoice.canCompleteTerminationHandover,
    poll: waiting,
    rolloverGone: notice?.requestedOption === 'ROLLOVER' && !invoice.canDeferToNextPeriod,
  };
}

export type TerminationOption = 'ROLLOVER' | 'PAYMENT_EXTENSION';
/** UTP:35: a rollover that is no longer possible becomes a payment extension. */
export const effectiveOption = (option: TerminationOption, canDefer: boolean): TerminationOption =>
  option === 'ROLLOVER' && !canDefer ? 'PAYMENT_EXTENSION' : option;

// --- deposit settlement payment (SPP) ---

/** `n.toLocaleString("vi-VN") + " đ"`. */
export const dong = (n: number) => `${numberVi(n)} đ`;

/** SPP:25-26, :52-54, :65, :74-83. */
export function settlementState(payment: PaymentRequest, isLandlord: boolean) {
  const refund = payment.direction === 'LANDLORD_TO_TENANT';
  const payer = refund ? isLandlord : !isLandlord;
  const title =
    payment.type === 'INITIAL_PAYMENT_REFUND'
      ? refund
        ? 'Hoàn tiền · Chủ nhà → Người thuê'
        : 'Hoàn tiền · Người thuê → Chủ nhà'
      : payment.type === 'DEPOSIT_ADJUSTMENT'
        ? refund
          ? 'Hoàn chênh lệch cọc · Chủ nhà → Người thuê'
          : 'Bổ sung cọc · Người thuê → Chủ nhà'
        : refund
          ? 'Hoàn cọc · Chủ nhà → Người thuê'
          : 'Quyết toán còn thiếu · Người thuê → Chủ nhà';
  return {
    title,
    payer,
    canTransfer: payer && TRANSFERABLE.includes(payment.status),
    canReceive: !payer && payment.status === 'TRANSFER_REPORTED',
    detailsOpen: payment.status !== 'CONFIRMED',
    showReceipt: payment.status === 'CONFIRMED' && payment.totalAmount > 0,
  };
}

export const SETTLEMENT_PROOF_INVALID = 'Chọn chứng từ chuyển khoản không quá 15 MB.';

// --- settlement lifecycle (CLP, settlement mode) ---

export type Bill = ContractLifecycle['billing']['bills'][number];

/** CLP:64-67. */
export const noDepositToRefund = (data: Pick<ContractLifecycle, 'heldDeposit' | 'refundPayment'>) =>
  data.heldDeposit === 0 && !data.refundPayment;

export const lastBilledOf = (bills: Bill[]) =>
  bills.reduce<Bill | undefined>(
    (latest, bill) => (!latest || bill.periodIndex > latest.periodIndex ? bill : latest),
    undefined
  );

/** CLP:211. */
export const billStatusText = (bill: Pick<Bill, 'status' | 'paymentStatus'>) =>
  bill.status === 'PAID'
    ? 'Đã xác nhận thanh toán'
    : bill.status === 'ROLLED_OVER'
      ? 'Đã chuyển nợ'
      : bill.paymentStatus === 'TRANSFER_REPORTED'
        ? 'Đã thanh toán · Chờ chủ nhà xác nhận'
        : bill.status === 'DRAFT'
          ? 'Chờ chốt chỉ số/phát hành'
          : 'Cần thanh toán';

/** CLP:214. */
export function billsSummaryText(data: ContractLifecycle) {
  const none = noDepositToRefund(data);
  if (!data.billing.allPaid)
    return none
      ? 'Chưa hoàn tất hóa đơn. Bước bàn giao/quyết toán đang khóa.'
      : 'Chưa hoàn tất hóa đơn. Bước quyết toán/hoàn cọc đang khóa.';
  if (data.closure?.status === 'CLOSED') return 'Tất cả hóa đơn đã hoàn tất.';
  if (data.earlyReturnPending)
    return 'Tất cả hóa đơn đã hoàn tất. Hai bên xác nhận bàn giao trong đề xuất quyết toán cọc.';
  return none
    ? 'Tất cả hóa đơn đã hoàn tất. Tiếp tục xác nhận trả nhà và quyết toán các khoản còn lại; không cần hoàn cọc.'
    : 'Tất cả hóa đơn đã hoàn tất. Có thể tiếp tục quyết toán cọc.';
}

/** CLP:142-159: supplementary final costs. */
export function supplementPayload(
  input: { electricity: string; water: string; description: string; amount: string },
  lastBilled?: Pick<Bill, 'electricityEnd' | 'waterEnd'>
) {
  const { description, amount } = input;
  // readingText turns "12," or "12." into "12" and a lone "." into "invalid".
  const reading = (text: string) => (text.trim() ? readingText(text) || 'NaN' : '');
  const electricity = reading(input.electricity);
  const water = reading(input.water);
  const values = [electricity, water, amount].filter((value) => value.trim());
  if (
    values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0) ||
    ((description.trim() || amount.trim()) && (!description.trim() || Number(amount) <= 0))
  )
    return {
      error: 'Nhập chỉ số hợp lệ; khoản phát sinh cần mô tả và số tiền lớn hơn 0.',
    } as const;
  for (const [value, start] of [
    [electricity, lastBilled?.electricityEnd],
    [water, lastBilled?.waterEnd],
  ] as const) {
    if (value.trim() && (start == null || Number(value) < start))
      return {
        error:
          start == null
            ? 'Chưa có chỉ số đã tính để đối chiếu; hãy kiểm tra hóa đơn.'
            : 'Chỉ số mới không được thấp hơn chỉ số đã tính trên hóa đơn.',
      } as const;
  }
  return {
    error: undefined,
    payload: {
      electricityEnd: electricity.trim() ? Number(electricity) : undefined,
      waterEnd: water.trim() ? Number(water) : undefined,
      extraCharges: description.trim()
        ? [{ description: description.trim(), amount: Number(amount) }]
        : [],
    },
  };
}

/** CLP:155-157: the same body keeps its request id, so a retry cannot bill twice. */
export function createRetryId(newId: () => string) {
  let last: { body: string; requestId: string } | null = null;
  return {
    idFor(payload: unknown) {
      const body = JSON.stringify(payload);
      if (last?.body !== body) last = { body, requestId: newId() };
      return last.requestId;
    },
    clear() {
      last = null;
    },
  };
}

export const deductionTotal = (rows: Pick<ClosureDeduction, 'amount'>[]) =>
  rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

export const PROPOSAL_INVALID =
  'Xác nhận bàn giao, nhập nội dung ít nhất 10 ký tự; mỗi khoản cần mô tả riêng và số tiền dương. Tổng tối đa 1 tỷ đồng.';

/** CLP:96-101. */
export function proposalError(
  handover: boolean,
  note: string,
  rows: Pick<ClosureDeduction, 'description' | 'amount'>[]
) {
  const total = deductionTotal(rows);
  return !handover ||
    note.trim().length < 10 ||
    !Number.isFinite(total) ||
    total > 1_000_000_000 ||
    rows.some(
      (row) => row.description.trim().length < 3 || !Number.isFinite(row.amount) || row.amount <= 0
    ) ||
    new Set(rows.map((row) => row.description.trim().toLowerCase())).size !== rows.length
    ? PROPOSAL_INVALID
    : null;
}

export const proposalKey = (contractId: string, version: number | undefined) =>
  `${contractId}:${version ?? 0}`;

/** CLP:293 (besides busy): why "Đồng ý quyết toán" is disabled. */
export function acceptBlocked(data: ContractLifecycle, consent: string | null, key: string) {
  const closure = data.closure;
  return (
    consent !== key ||
    !data.billing.allPaid ||
    (closure?.utilityAdjustment ?? 0) > 0 ||
    Boolean(closure?.complaintCaseId && !closure.complaintOwnerApprovedAt)
  );
}

/** CLP:236. */
export const transferOverdue = (data: ContractLifecycle) =>
  !!data.closure?.refundDueAt &&
  data.closure.status !== 'CLOSED' &&
  new Date(data.serverNow) > new Date(data.closure.refundDueAt);

export const CLOSURE_FILE_RULE = 'Tối đa 5 ảnh JPG/PNG/WebP hoặc PDF, mỗi tệp không quá 15 MB.';

// --- complaints (CP) ---

export const COMPLAINT_FILE_RULE = 'Tối đa 5 ảnh JPG/PNG/WebP hoặc PDF, 15 MB/tệp.';

/** CP:34-39. `selected` pins one record; an unknown id never falls back to another record. */
export function complaintView(
  rows: ComplaintCase[],
  rentalRequestId: string,
  userId: string | null,
  selected: string,
  chosenAction: string
) {
  const scoped = rows.filter(
    (c) =>
      c.rentalRequestId === rentalRequestId && [c.tenantId, c.landlordId].includes(userId ?? '')
  );
  const current = selected
    ? scoped.find((c) => c.id === selected)
    : (scoped.find((c) => c.status !== 'RESOLVED') ?? scoped[0]);
  const actions = current?.finalClosed
    ? []
    : (current?.allowedActions.filter((a) =>
        ['COMMENT', 'ESCALATE', 'CLOSE', 'WITHDRAW', 'REOPEN'].includes(a)
      ) ?? []);
  const activeAction = actions.includes(chosenAction)
    ? chosenAction
    : actions.includes('COMMENT')
      ? 'COMMENT'
      : (actions[0] as string | undefined);
  return { scoped, current, actions, activeAction };
}

/** The record, revision and action an unsent draft was written for. */
export type ComplaintDraft = { caseId: string; revision: number; action: string };
export const COMPLAINT_DRAFT_STALE =
  'Hồ sơ hoặc thao tác đã thay đổi. Nội dung vẫn được giữ; hãy đối chiếu hồ sơ và chọn lại thao tác trước khi gửi.';

/** True when sending now would apply the draft to another record, revision or action. */
export const complaintDraftStale = (
  draft: ComplaintDraft | null,
  current: Pick<ComplaintCase, 'id' | 'revision'> | undefined,
  activeAction: string | undefined
) =>
  !!draft &&
  (current?.id !== draft.caseId ||
    current.revision !== draft.revision ||
    activeAction !== draft.action);

export const complaintReasonValid = (reason: string) =>
  reason.trim().length >= 10 && reason.trim().length <= 500;

/** CP:131 (also the guard of perform, CP:63). */
export const complaintSendDisabled = (input: {
  busy: boolean;
  picking: boolean;
  reason: string;
  creating: boolean;
  canCreate: boolean;
  activeAction?: string;
  fileCount: number;
  stale?: boolean;
}) =>
  input.busy ||
  !!input.stale ||
  input.picking ||
  !complaintReasonValid(input.reason) ||
  (input.creating && !input.canCreate) ||
  (!input.creating &&
    (!input.activeAction || (input.activeAction !== 'COMMENT' && input.fileCount > 0)));

/** Uploads in order and remembers each file, so a retry does not upload it again. */
export async function uploadAll<F extends { uri: string }>(
  files: F[],
  cache: Map<string, string>,
  upload: (file: F) => Promise<string>
) {
  const ids: string[] = [];
  for (const file of files) {
    let id = cache.get(file.uri);
    if (!id) {
      id = await upload(file);
      cache.set(file.uri, id);
    }
    ids.push(id);
  }
  return ids;
}

// --- payment lookup (app/dashboard/payments/page.tsx) ---

const PAYMENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Only compared with the viewer's own list; the id is never sent to an endpoint. */
export function findOwnPayment(payments: PaymentRequest[], paymentId: string, userId: string) {
  const id = paymentId.trim();
  if (!PAYMENT_ID.test(id)) return undefined;
  return payments.find((p) => p.id === id && (userId === p.payerId || userId === p.payeeId));
}

// --- payment history (PRP) ---

export const RECEIPT_PAGE_SIZE = PAGE_SIZE;

export const receiptQuery = (
  role: 'landlord' | 'tenant',
  contractId: string | undefined,
  page: number
) => ({
  role: role.toUpperCase() as 'LANDLORD' | 'TENANT',
  contractId,
  page,
  size: RECEIPT_PAGE_SIZE,
});

// The browser's (CLDR) fraction digits per currency code; every other code has 2.
const NO_FRACTION = (
  'AFN ALL BIF CLP COP DJF GNF HUF IDR IQD IRR ISK JPY KMF KPW KRW LAK LBP MGA MMK PKR PYG RWF ' +
  'SLL SOS SYP UGX VND VUV XAF XOF XPF YER'
).split(' ');
const THREE_FRACTION = 'BHD JOD KWD LYD OMR TND'.split(' ');

/** `Intl.NumberFormat("vi-VN", {style: "currency", currency})` without Hermes Intl. */
export function receiptMoney({ totalAmount, currency }: { totalAmount: number; currency: string }) {
  if (currency === 'VND') return currencyVnd(totalAmount);
  const digits = NO_FRACTION.includes(currency) ? 0 : THREE_FRACTION.includes(currency) ? 3 : 2;
  const [whole, fraction = ''] = formatNumberVi(roundDecimal(totalAmount, digits), digits).split(
    ','
  );
  return `${digits ? `${whole},${fraction.padEnd(digits, '0')}` : whole}\u00a0${currency}`;
}

export const receiptSubtitle = (row: {
  contractNumber?: string;
  propertyAddress?: string;
  day: string;
  payerName: string;
  payeeName: string;
}) =>
  [row.contractNumber ?? row.propertyAddress, row.day, `${row.payerName} → ${row.payeeName}`]
    .filter(Boolean)
    .join(' · ');

/** PRA:50-56: the toast when the PDF is not ready yet. */
export const receiptNotReady = (status: string) =>
  status === 'FAILED'
    ? 'PDF chưa tạo được. Mở mục Chứng từ thanh toán để thử lại.'
    : 'PDF đang được chuẩn bị. Bạn có thể xem lại sau ít phút.';

/** A server receipt number as a file name. */
export const receiptFileName = (receiptNumber: string) =>
  `${receiptNumber.replace(/[\\/:*?"<>|\s]+/g, '-') || 'chung-tu'}.pdf`;
