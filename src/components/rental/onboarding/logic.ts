// Pure decisions of the onboarding screens, cut out of the web components (file:line noted on each).
// No React Native imports: tests/rental-onboarding.test.cjs runs them against the web source.
import { assertProofRecorded } from '@/components/rental/billing/logic';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { span } from '@/lib/rental/OnboardingPaymentCard';
import { selectOnboardingPayment } from '@/lib/rental/rental-deposit-quick-view';
import { transferWindowClosed } from '@/lib/rental/rental-request-presentation';
import { PROOF_REJECTED_TOAST, proofFileError } from '@/lib/rental/RentalPaymentModal';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';
import type { LocalFile } from '@/services/storageApi';
import type { PaymentRequest, ReportTransferPayload } from '@/types/rental/payment-request.type';
import type { RentalWorkflow, WorkflowKind } from '@/types/rental/rental-workflow.type';
import { workflowActions } from '@/types/rental/rental-workflow.type';

// --- OnboardingPaymentCard.tsx:31-43: who may pay / confirm / review one payment ---

export function paymentCardState(
  p: Pick<PaymentRequest, 'status' | 'type' | 'direction' | 'totalAmount' | 'dueAt'>,
  view: Pick<RentalOnboarding, 'serverNow' | 'cancellationRequestedAt'>,
  isOwner: boolean
) {
  // The server clock of the last read, never the device clock.
  const now = new Date(view.serverNow).getTime();
  const due = p.dueAt ? new Date(p.dueAt).getTime() : null;
  const overdue = p.status === 'AWAITING_TRANSFER' && due !== null && now >= due;
  const refund = p.type === 'INITIAL_PAYMENT_REFUND';

  const canPay =
    (p.direction === 'LANDLORD_TO_TENANT' ? isOwner : !isOwner && !view.cancellationRequestedAt) &&
    p.totalAmount > 0 &&
    (p.status === 'AWAITING_TRANSFER' || (refund && p.status === 'REJECTED')) &&
    (refund || due === null || now < due);
  const canReceive =
    (p.direction === 'LANDLORD_TO_TENANT' ? !isOwner : isOwner) && p.status === 'TRANSFER_REPORTED';
  const canReview =
    isOwner && p.direction === 'TENANT_TO_LANDLORD' && (p.status === 'REJECTED' || overdue);

  const open = p.status === 'AWAITING_TRANSFER' || p.status === 'REJECTED';
  const countdown =
    open && due !== null
      ? now >= due
        ? { late: true, text: `Quá hạn ${span(now - due)}` }
        : { late: false, text: `Còn ${span(due - now)}` }
      : null;

  return {
    overdue,
    statusKey: overdue ? 'OVERDUE' : p.status,
    canPay,
    canReceive,
    canReview,
    countdown,
  };
}

// --- RentalPaymentModal.tsx:128-133 and :255-258 ---

export const PAYMENT_NOT_VISIBLE = 'Không tìm thấy khoản chuyển khoản hoặc bạn không có quyền xem.';

/** A loaded payment is shown only if it is the asked one, of this request, and the viewer is a party. */
export function assertViewerPayment(
  next: PaymentRequest,
  expected: { paymentId?: string; requestId: string; userId: string }
): PaymentRequest {
  if (
    (expected.paymentId && next.id !== expected.paymentId) ||
    next.rentalRequestId !== expected.requestId ||
    !expected.userId ||
    (expected.userId !== next.payerId && expected.userId !== next.payeeId)
  )
    throw new Error(PAYMENT_NOT_VISIBLE);
  return next;
}

export function transferReportState(
  payment: PaymentRequest | null,
  userId: string | null,
  nowMs: number
) {
  const windowClosed = transferWindowClosed(payment, nowMs);
  const canReport = Boolean(
    payment &&
    userId === payment.payerId &&
    !windowClosed &&
    ['AWAITING_TRANSFER', 'REJECTED', 'OVERDUE'].includes(payment.status)
  );
  return { windowClosed, canReport };
}

// --- Single flight (RentalPaymentModal.tsx:121-138, RentalWorkflowPanel.tsx:65-86, WorkflowDocumentsPanel.tsx:25-37) ---

/**
 * One read in flight; callers arriving meanwhile share it and get one fresh follow-up, also after a
 * failed read. `read` handles its own errors; `superseded()` is true once a follow-up is queued.
 */
export function createCoalesced(
  read: (superseded: () => boolean) => Promise<void>,
  isAlive: () => boolean,
  /** Asked before a follow-up: true = not now, the caller runs it later (web: hidden tab). */
  defer?: () => boolean
) {
  let inflight: Promise<void> | null = null;
  let dirty = false;
  return (): Promise<void> => {
    if (!isAlive()) return Promise.resolve();
    if (inflight) {
      dirty = true;
      return inflight;
    }
    const run = (async () => {
      await null; // `inflight` is assigned before `finally` can clear it
      try {
        do {
          dirty = false;
          await read(() => dirty);
        } while (dirty && isAlive() && !defer?.());
      } finally {
        inflight = null;
      }
    })();
    inflight = run;
    return run;
  };
}

// --- Transfer proof: RentalPaymentModal.tsx:299-364 and :409-459 (LOCAL source only, Q2) ---

export const PROOF_UPLOAD_FAILED = 'Tải chứng từ thất bại. Vui lòng thử lại.';
export const PROOF_STILL_UPLOADING = 'Tệp chứng từ đang được tải lên. Vui lòng chờ trong giây lát.';
export const PROOF_REQUIRED = 'Vui lòng đính kèm ảnh hoặc tệp chứng từ chuyển khoản.';
export const PROOF_REPORT_FAILED = 'Không thể gửi báo cáo chuyển khoản. Vui lòng thử lại.';

export type ProofState = {
  file: LocalFile | null;
  status: 'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR';
  storageId: string | null;
  error: string | null;
  submitting: boolean;
  /** A device picker is open or its selection is not handled yet. */
  picking: boolean;
};

export const EMPTY_PROOF: ProofState = {
  file: null,
  status: 'IDLE',
  storageId: null,
  error: null,
  submitting: false,
  picking: false,
};

export function createProofFlow(deps: {
  upload: (file: LocalFile, paymentId: string) => Promise<string>;
  report: (paymentId: string, payload: ReportTransferPayload) => Promise<PaymentRequest>;
  onChange: (state: ProofState) => void;
  onError: (message: string) => void;
  /** The report was answered without this upload: read the payment again. */
  reload: () => void;
  /** False once the modal is closed: late answers are dropped and nothing more is sent. */
  isAlive: () => boolean;
}) {
  let state = EMPTY_PROOF;
  // Only the newest pick may set the storage id (stricter than web, which lets a slow older upload win).
  let pick = 0;
  let submitLock = false;
  // The payment the draft belongs to; `draft` moves on when the loaded payment changes.
  let boundId: string | null = null;
  let draft = 0;

  const set = (patch: Partial<ProofState>) => {
    if (!deps.isAlive()) return;
    state = { ...state, ...patch };
    deps.onChange(state);
  };

  /** A refused file also drops the previous one. */
  const reject = (message: string) => {
    if (submitLock) return;
    pick++;
    set({ file: null, storageId: null, status: 'ERROR', error: message });
    deps.onError(PROOF_REJECTED_TOAST);
  };

  return {
    reject,
    /** Call with each loaded payment. True when it is another one: the old draft is dropped. */
    bind(paymentId: string) {
      const changed = boundId !== null && boundId !== paymentId;
      boundId = paymentId;
      if (!changed) return false;
      draft++;
      pick++;
      submitLock = false;
      set({ ...EMPTY_PROOF, picking: state.picking });
      return true;
    },
    setPicking(picking: boolean) {
      set({ picking });
    },
    remove() {
      if (submitLock) return;
      pick++;
      set({ file: null, storageId: null, status: 'IDLE', error: null });
    },
    /** Validates, then uploads at once. */
    async select(file: LocalFile, paymentId: string) {
      if (!deps.isAlive() || submitLock) return;
      boundId ??= paymentId;
      if (paymentId !== boundId) return;
      const invalid = proofFileError({ type: file.contentType, size: file.sizeBytes });
      if (invalid) return reject(invalid);
      const mine = ++pick;
      set({ file, storageId: null, status: 'UPLOADING', error: null });
      try {
        const storageId = await deps.upload(file, paymentId);
        if (mine === pick) set({ storageId, status: 'SUCCESS' });
      } catch (error) {
        if (mine !== pick || !deps.isAlive()) return;
        set({ status: 'ERROR', error: getApiErrorMessage(error, PROOF_UPLOAD_FAILED) });
        deps.onError(PROOF_UPLOAD_FAILED);
      }
    },
    /** The updated payment once it holds this upload, otherwise null. One report at a time. */
    async submit(
      payment: Pick<PaymentRequest, 'id' | 'totalAmount'>,
      canReport: boolean
    ): Promise<PaymentRequest | null> {
      if (!deps.isAlive() || submitLock || state.picking || !canReport) return null;
      if (boundId !== null && payment.id !== boundId) return null;
      const mine = draft;
      const current = () => deps.isAlive() && mine === draft;
      if (state.status === 'UPLOADING') {
        deps.onError(PROOF_STILL_UPLOADING);
        return null;
      }
      const { file } = state;
      let { storageId } = state;
      if (!storageId && !file) {
        deps.onError(PROOF_REQUIRED);
        return null;
      }
      submitLock = true;
      set({ submitting: true });
      try {
        if (!storageId) {
          // The earlier upload failed: try it again before reporting.
          try {
            storageId = await deps.upload(file!, payment.id);
          } catch {
            if (current()) {
              set({ status: 'ERROR' });
              deps.onError(PROOF_UPLOAD_FAILED);
            }
            return null;
          }
          if (!current()) return null;
          set({ storageId, status: 'SUCCESS' });
        }
        try {
          const updated = await deps.report(payment.id, {
            expectedAmount: payment.totalAmount,
            proofStorageId: storageId,
          });
          if (!current()) return null;
          try {
            assertProofRecorded(updated, storageId);
          } catch (error) {
            // The selection stays; the reload shows which proof the payment really holds.
            deps.onError(getApiErrorMessage(error, PROOF_REPORT_FAILED));
            deps.reload();
            return null;
          }
          return updated;
        } catch (error) {
          if (current()) deps.onError(getApiErrorMessage(error, PROOF_REPORT_FAILED));
          return null;
        }
      } finally {
        if (mine === draft) {
          submitLock = false;
          set({ submitting: false });
        }
      }
    },
  };
}

// --- RentalOnboardingPanel.tsx:112-123 ---

export type Notify = {
  success: (message: string) => void;
  info: (message: string) => void;
  error: (message: string) => void;
};

/** One action at a time. A reload that fails after the action succeeded must not read as a failed action. */
export async function runPanelAction<T>(
  lock: { current: boolean },
  task: () => Promise<unknown>,
  steps: {
    setBusy: (busy: boolean) => void;
    waitInflight: () => Promise<unknown>;
    reload: () => Promise<T | undefined>;
    onUpdated?: (data: T) => unknown;
    closeForm: () => void;
    notify: Notify;
  }
) {
  if (lock.current) return;
  lock.current = true;
  steps.setBusy(true);
  let done = false;
  try {
    await task();
    done = true;
    await steps.waitInflight();
    const data = await steps.reload();
    if (!data) throw new Error('reload failed');
    await steps.onUpdated?.(data);
    steps.closeForm();
    steps.notify.success('Đã cập nhật hồ sơ.');
  } catch (error) {
    if (done) {
      steps.closeForm();
      steps.notify.info('Đã cập nhật, chưa tải lại được dữ liệu.');
    } else steps.notify.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác.'));
  } finally {
    lock.current = false;
    steps.setBusy(false);
  }
}

/** RentalOnboardingPanel.tsx:258, title of the default-notice box. */
export function defaultCaseTitle(
  defaultCase: NonNullable<RentalOnboarding['defaultCase']>,
  stage: string,
  noticeOpen: boolean
) {
  if (defaultCase.completedAt) return 'Đã hủy giữ phòng · Chủ nhà giữ tiền cọc';
  if (stage === 'CANCELLATION_REFUND_PENDING')
    return 'Đang chờ hoàn tiền · Thông báo giữ cọc cũ hết hiệu lực';
  if (!noticeOpen) return 'Hồ sơ đã kết thúc / hoàn tất ký · Thông báo cũ không còn áp dụng';
  if (defaultCase.disputedAt) return 'Đang có phản hồi · Chặn giữ cọc, cần đối soát';
  return 'Hạn cuối để hoàn tất thủ tục thuê';
}

// --- RentalDepositQuickViewModal.tsx:96-106 ---

export async function loadQuickView(
  api: {
    readView: (requestId: string) => Promise<RentalOnboarding>;
    getPayment: (paymentId: string) => Promise<PaymentRequest>;
  },
  target: { requestId: string; userId: string; paymentId: string | null }
) {
  const view = await api.readView(target.requestId);
  if (view.askerRole !== 'LANDLORD')
    throw new Error('Bạn không có quyền xem nhanh với vai trò chủ nhà.');
  const selected = selectOnboardingPayment(view.payments, target.requestId, target.paymentId);
  if (!selected)
    throw new Error(
      'Không tìm thấy khoản thanh toán đã chọn trong hồ sơ này. Vui lòng tải lại danh sách.'
    );
  const payment = await api.getPayment(selected.id);
  if (
    payment.id !== selected.id ||
    !selectOnboardingPayment([payment], target.requestId, payment.id) ||
    !target.userId ||
    payment.payeeId !== target.userId
  )
    throw new Error('Bạn không có quyền nhận tiền của khoản thanh toán này.');
  return { view, payment };
}

// --- RentalWorkflowPanel.tsx:51, :59-61, :121-140, :179-181 ---

const ACK_ACTIONS = ['REQUEST_RESUME', 'RESUME', 'ACCEPT', 'CONFIRM_RETURN', 'FULL_REFUND_EXIT'];

export const workflowActionLabel = (action: string, earlyExit: boolean) =>
  earlyExit && action === 'ACCEPT'
    ? 'Đồng ý và tạo phụ lục'
    : action === 'CANCEL'
      ? 'Hủy đề nghị chờ ký'
      : (workflowActions[action] ?? action);

export const workflowPrefilledReason = (action: string) =>
  action === 'ACCEPT'
    ? 'Tôi đồng ý lập phụ lục điều chỉnh thời hạn để hai bên ký số'
    : action === 'CONFIRM_RETURN'
      ? 'Tôi xác nhận nhà, chìa khóa và tài sản đã được bàn giao thực tế'
      : '';

export const needsAck = (action: string, earlyExit: boolean) =>
  ACK_ACTIONS.includes(action) || (action === 'PROPOSE' && !earlyExit);

export const workflowReasonValid = (reason: string) =>
  reason.trim().length >= 10 && reason.trim().length <= 1000;

export const showsAckBox = (earlyExit: boolean, creating: boolean, selectedAction: string | null) =>
  !earlyExit || (!creating && ['ACCEPT', 'CONFIRM_RETURN'].includes(selectedAction ?? ''));

export function workflowAckText(
  data: Pick<RentalWorkflow, 'status' | 'allowedActions'>,
  kind: WorkflowKind,
  creating: boolean,
  selectedAction: string | null
) {
  const text =
    data.status === 'RESUME_PROPOSED' || data.allowedActions.includes('REQUEST_RESUME')
      ? 'Tôi đồng ý tiếp tục thuê và ký theo hồ sơ hiện tại; không tự thay đổi điều khoản, chữ ký hoặc xác nhận tiền.'
      : kind === 'cancellation'
        ? 'Tôi đã đối chiếu đề nghị hủy và khoản hoàn (nếu HĐ cọc đã đủ chữ ký, tiền cọc không được hoàn); phòng chưa bàn giao hoặc đã được nhận lại đầy đủ, không còn người thuê/tài sản của khách trong phòng.'
        : creating
          ? 'Tôi đã kiểm tra ngày kết thúc, cách bàn giao, tiền thuê kỳ cuối và khoản hoàn; đồng ý gửi đề nghị này cho bên còn lại.'
          : selectedAction === 'ACCEPT'
            ? 'Tôi đã đọc và đồng ý toàn bộ điều kiện của đúng phiên bản đề nghị này. Đồng ý chỉ chuyển sang lập phụ lục; hạn thuê cũ vẫn áp dụng cho đến khi đủ hai chữ ký số hợp lệ.'
            : 'Tôi xác nhận nhà, chìa khóa và tài sản đã được trả/nhận lại thực tế.';
  return `${text} Việc này không thay bước xác nhận nhận tiền.`;
}

export type WorkflowInput = {
  earlyExit: boolean;
  needsReview: boolean;
  reason: string;
  ack: boolean;
  contacted: boolean;
  /** Early exit: an allowed last day is chosen. */
  proposalValid: boolean;
  /** An evidence selection is still in progress. */
  picking?: boolean;
};

/** The button's disabled state (:181) without `busy`. */
export function workflowActionBlocked(action: string, creating: boolean, input: WorkflowInput) {
  return (
    Boolean(input.picking) ||
    input.needsReview ||
    !workflowReasonValid(input.reason) ||
    (creating && !input.proposalValid) ||
    (needsAck(action, input.earlyExit) && !input.ack) ||
    (action === 'FULL_REFUND_EXIT' && !input.contacted)
  );
}

export async function performWorkflowAction(
  action: string,
  input: WorkflowInput & {
    data: RentalWorkflow | null;
    /** Chosen end date (endExclusive) of an early-exit proposal. */
    endExclusive: string;
    files: LocalFile[];
  },
  deps: {
    lock: { current: boolean };
    /** Keyed by file uri: a retried proposal does not upload the same file twice. */
    uploaded: Map<string, string>;
    isAlive: () => boolean;
    setBusy: (busy: boolean) => void;
    upload: (file: LocalFile) => Promise<string>;
    propose: (payload: object) => Promise<RentalWorkflow>;
    act: (
      action: string,
      payload: {
        expectedRevision: number;
        reason: string;
        acknowledged: boolean;
        tenantContacted: boolean;
      }
    ) => Promise<RentalWorkflow>;
    onSaved: () => void;
    refresh: () => Promise<void>;
    accept: (result?: RentalWorkflow) => void;
    onUpdated?: () => unknown;
    notify: Pick<Notify, 'success' | 'error'>;
  }
) {
  const { data, reason, earlyExit, ack, contacted, files } = input;
  if (
    deps.lock.current ||
    input.picking ||
    !data ||
    !data.allowedActions.includes(action) ||
    !workflowReasonValid(reason) ||
    input.needsReview ||
    (action === 'PROPOSE' && !input.proposalValid)
  )
    return;
  if (needsAck(action, earlyExit) && !ack) return;
  if (action === 'FULL_REFUND_EXIT' && !contacted) return;
  if (action !== 'PROPOSE' && files.length) {
    deps.notify.error('Bằng chứng cần được gắn vào đề xuất mới trước khi thao tác.');
    return;
  }
  let result: RentalWorkflow | undefined;
  let saved = false;
  deps.lock.current = true;
  deps.setBusy(true);
  try {
    if (action === 'PROPOSE') {
      const evidenceIds: string[] = [];
      for (const file of files) {
        let id = deps.uploaded.get(file.uri);
        if (!id) {
          id = await deps.upload(file);
          deps.uploaded.set(file.uri, id);
        }
        if (!deps.isAlive()) return;
        evidenceIds.push(id);
      }
      result = await deps.propose({
        expectedRevision: data.revision,
        reason: reason.trim(),
        evidenceIds,
        ...(earlyExit ? { endExclusive: input.endExclusive } : {}),
      });
    } else
      result = await deps.act(action, {
        expectedRevision: data.revision,
        reason: reason.trim(),
        acknowledged: ack,
        tenantContacted: contacted,
      });
    saved = true;
    if (!deps.isAlive()) return;
    deps.onSaved();
    await deps.refresh();
    deps.accept(result);
    deps.notify.success('Đã ghi nhận thao tác và lịch sử.');
    if (deps.isAlive()) await deps.onUpdated?.();
  } catch (error) {
    if (deps.isAlive()) {
      deps.notify.error(
        saved
          ? 'Thao tác đã được ghi nhận, nhưng chưa làm mới được toàn bộ hồ sơ. Vui lòng tải lại; không cần gửi lại thao tác.'
          : getApiErrorMessage(error, 'Chưa thể thực hiện. Kiểm tra dữ liệu mới trước khi gửi lại.')
      );
      if (!saved) await deps.refresh();
    }
  } finally {
    deps.lock.current = false;
    if (deps.isAlive()) deps.setBusy(false);
  }
}
