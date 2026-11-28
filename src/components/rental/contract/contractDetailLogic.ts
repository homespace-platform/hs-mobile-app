// Decisions of the contract landing / detail / header that the web keeps inside .tsx files.
// Line numbers: DV = ContractDetailView.tsx, HD = detail/ContractHeader.tsx, LD = app/dashboard/contracts/[id]/page.tsx.
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { isDraftConflictError, isoDate, money, POST_ACTIVE } from '@/lib/rental/ContractDetailView';
import { requiresVerifiedContent } from '@/lib/rental/contract-document-history';
import { generateContractPreview } from '@/lib/rental/contract-preview';
import type { ContractRoute, ContractRouteQuery } from '@/lib/rental/contract-routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { contractLandingTarget, safeResourceId } from '@/lib/rental/payment-module';
import { primaryLabel, type NextStep, type StepLink } from '@/lib/rental/nextStep';
import type { DetailTab, NextActionView } from '@/lib/rental/rental-labels';
import { isZeroDeposit } from '@/lib/rental/utils';
import { amendmentNumbers } from '@/lib/rental/contract-amendment-input';
import type { AmendmentTerms, TermRow } from '@/types/rental/contract-amendment.type';
import type {
  ContractCompletenessResponse,
  ContractDocumentResponse,
  ContractResponse,
  ContractRevisionResponse,
  UpdateContractRevisionRequest,
} from '@/types/rental/contract.type';

// ---------------------------------------------------------------- landing (LD:19-60)

export type LandingResult =
  | { kind: 'missing' }
  | { kind: 'retry' }
  | { kind: 'redirect'; target: ContractRoute }
  | { kind: 'workflow'; rootId: string; side: DashboardRole; earlyExitRentalRequestId?: string };

/** The viewer's side comes from the signed-in account vs the contract parties, never a stored role. */
export async function resolveLanding(
  input: { userId: string; contractId: string; query: ContractRouteQuery },
  io: {
    getContract: (id: string) => Promise<ContractResponse>;
    earlyExitDocuments: (
      rentalRequestId: string
    ) => Promise<{ signingContractId?: string | null }[]>;
  }
): Promise<LandingResult> {
  const { userId, contractId, query } = input;
  try {
    const contract = await io.getContract(contractId);
    const side: DashboardRole | null =
      userId === contract?.landlordId
        ? 'landlord'
        : userId === contract?.tenantId
          ? 'tenant'
          : null;
    if (!side || contract.id !== contractId) return { kind: 'missing' };
    if (contract.agreementKind === 'WORKFLOW') {
      const rootId = safeResourceId(contract.parentContractId);
      if (!rootId) return { kind: 'missing' };
      const rentalRequestId = safeResourceId(contract.rentalRequestId);
      if (rentalRequestId) {
        const documents = await io.earlyExitDocuments(rentalRequestId);
        if (documents.some((document) => document.signingContractId === contractId))
          return { kind: 'workflow', rootId, side, earlyExitRentalRequestId: rentalRequestId };
      }
      return { kind: 'workflow', rootId, side };
    }
    return { kind: 'redirect', target: contractLandingTarget(side, contract, query) };
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return { kind: status === 400 || status === 403 || status === 404 ? 'missing' : 'retry' };
  }
}

// ---------------------------------------------------------------- tabs and viewer (DV:106-113, :484, :581)

export function availableTabs(
  contract: Pick<ContractResponse, 'agreementKind' | 'parentContractId'>
): DetailTab[] {
  if (contract.agreementKind === 'DEPOSIT')
    return ['overview', 'sign', 'payment', 'end', 'history'];
  return contract.parentContractId
    ? ['overview', 'sign', 'content']
    : ['overview', 'sign', 'payment', 'end', 'content', 'history'];
}

export function viewerSide(
  perspective: DashboardRole,
  profileId: string | null | undefined,
  contract: Pick<ContractResponse, 'landlordId' | 'tenantId'> | null
) {
  const isLandlord = Boolean(
    perspective === 'landlord' &&
    profileId &&
    contract?.landlordId &&
    profileId === contract.landlordId
  );
  const isTenant = Boolean(
    perspective === 'tenant' && profileId && contract?.tenantId && profileId === contract.tenantId
  );
  return { isLandlord, isTenant };
}

/** EndTab.tsx:55-57: which blocks follow the cancel rules. */
export function endBlocks(
  contract: Pick<ContractResponse, 'status' | 'parentContractId'>,
  preActive: boolean
) {
  const effective =
    !preActive && !contract.parentContractId && POST_ACTIVE.includes(contract.status);
  return {
    earlyExit: effective,
    renewal: effective && contract.status === 'ACTIVE',
    amendments: effective && ['ACTIVE', 'EXPIRED', 'CLOSED'].includes(contract.status),
    complaint: effective && contract.status === 'ACTIVE',
  };
}

// ---------------------------------------------------------------- next step card (ContractPage.tsx:91-115)

export type StepButton = { label: string; tab?: DetailTab; link?: StepLink };

export function stepButtons(input: {
  /** Pre-tenancy: describeNextAction of the server's step. */
  view: NextActionView | null;
  step: NextStep | null;
  active: DetailTab;
}): { primary?: StepButton; secondary: StepButton[] } {
  const { view, step, active } = input;
  let primary: StepButton | undefined;
  const secondary: StepButton[] = [];
  if (view?.mine && view.tab !== active) primary = { label: primaryLabel(view.tab), tab: view.tab };
  if (step) {
    const { link } = step;
    if (step.mine && link) primary = { label: step.cta ?? 'Mở', link };
    else if (step.mine && step.tab && step.tab !== active)
      primary = { label: step.cta ?? primaryLabel(step.tab), tab: step.tab };
    else if (link)
      secondary.push({
        label:
          link.kind === 'invoices'
            ? link.section === 'deposit'
              ? 'Xem cọc & hoàn cọc'
              : 'Xem hóa đơn'
            : 'Mở hồ sơ liên quan',
        link,
      });
  }
  return { primary, secondary };
}

export function pageStep(
  preActive: boolean,
  onboardingLoaded: boolean,
  onboardingError: boolean,
  hasStep: boolean
) {
  if (preActive) return onboardingLoaded ? 'server' : onboardingError ? 'error' : 'loading';
  return hasStep ? 'derived' : null;
}

// ---------------------------------------------------------------- tabs content

/** OverviewTab.tsx:75-78, :90-98. `bills` null = the lifecycle is not loaded yet. */
export function invoiceSummary(
  bills: { status: string; totalAmount: number }[] | null,
  role: 'LANDLORD' | 'TENANT'
): { title: string; detail?: string } {
  if (!bills) return { title: 'Đang tải tình trạng hóa đơn…' };
  const open = bills.filter((b) => ['DRAFT', 'UNPAID', 'OVERDUE'].includes(b.status));
  if (!open.length) return { title: 'Không có hóa đơn nào đang chờ xử lý' };
  const overdue = open.filter((b) => b.status === 'OVERDUE').length;
  const owed = open.filter((b) => b.status !== 'DRAFT').reduce((sum, b) => sum + b.totalAmount, 0);
  return {
    title: `${open.length} hóa đơn chưa hoàn tất${owed > 0 ? ` · ${money(owed)}` : ''}`,
    detail:
      overdue > 0
        ? `${overdue} hóa đơn đã quá hạn`
        : role === 'TENANT'
          ? 'Thanh toán trước hạn để tránh phí chậm trả'
          : 'Theo dõi và xác nhận thanh toán của người thuê',
  };
}

/** PaymentTab.tsx:40-44: what the monthly invoices need from the revision. */
export function monthlyInvoiceInputs(revision?: ContractRevisionResponse | null) {
  const charges: TermRow[] = revision?.charges ?? [];
  const meter = (value: unknown) => (value == null ? undefined : String(value));
  return {
    electricityRequired: charges.some(
      (c) => c.chargeType === 'ELECTRICITY' && c.billingMethod === 'PER_KWH'
    ),
    waterRequired: charges.some((c) => c.billingMethod === 'PER_M3'),
    unsupportedWaterRate: charges.some(
      (c) => c.billingMethod === 'STATE_WATER_RATE' && c.includedInRent !== true
    ),
    initialElectricity: meter(revision?.meters?.electricityInitial),
    initialWater: meter(revision?.meters?.waterInitial),
  };
}

// ---------------------------------------------------------------- facts and info cards (DV:486-609)

export type SummaryFact = {
  label: string;
  icon: 'cash-outline' | 'calendar-outline' | 'person-outline' | 'location-outline';
  value?: string;
  /** Second, lighter line. */
  sub?: string;
};
export type InfoCardData = { title: string; rows: [string, string | undefined][] };

const text = (value: unknown) =>
  value == null || String(value).trim() === '' ? undefined : String(value);

type DepositSnapshot = {
  deposit?: { originalAmount?: number | null; heldAmount?: number | null } | null;
  startsOn: string;
  endExclusive: string;
} | null;

const amount = (value: number | null | undefined) => (value != null ? money(value) : undefined);

export function depositFacts(onboarding: DepositSnapshot): SummaryFact[] {
  return [
    { label: 'Tiền cọc', icon: 'cash-outline', value: amount(onboarding?.deposit?.originalAmount) },
    {
      label: 'Thời hạn thuê',
      icon: 'calendar-outline',
      value: onboarding
        ? `${isoDate(onboarding.startsOn)} – ${isoDate(onboarding.endExclusive)}`
        : undefined,
    },
  ];
}

export function depositCards(statusLabel: string, onboarding: DepositSnapshot): InfoCardData[] {
  return [
    {
      title: 'Hợp đồng cọc & giữ phòng',
      rows: [
        ['Trạng thái', statusLabel],
        ['Tiền cọc', amount(onboarding?.deposit?.originalAmount)],
        ['Đang giữ', amount(onboarding?.deposit?.heldAmount)],
      ],
    },
  ];
}

/** Last occupied day text after a signed early-termination addendum: agreed exclusive end - 1 day. */
export function effectiveEndText(
  contract: Pick<ContractResponse, 'parentContractId' | 'agreedEarlyEndExclusive'>
): string | undefined {
  if (contract.parentContractId || !contract.agreedEarlyEndExclusive) return undefined;
  const end = new Date(`${contract.agreedEarlyEndExclusive.split('T')[0]}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return undefined;
  end.setUTCDate(end.getUTCDate() - 1);
  return isoDate(end.toISOString());
}

export function leaseSummary(input: {
  contract: Pick<ContractResponse, 'parentContractId' | 'agreedEarlyEndExclusive'>;
  isLandlord: boolean;
  landlord: TermRow;
  tenant: TermRow;
  property: TermRow;
  lease: TermRow;
  financial: TermRow;
}): { facts: SummaryFact[]; cards: InfoCardData[] } {
  const { isLandlord, landlord, tenant, property, lease, financial } = input;
  const counterpart = isLandlord ? tenant : landlord;
  const earlyEnd = effectiveEndText(input.contract);
  const leaseEnd = earlyEnd ?? text(lease.endDateText);
  const title = text(property.title) ?? text(property.listingTitle) ?? text(property.propertyType);
  const address = text(property.fullAddress);
  const zeroDeposit = isZeroDeposit(financial.depositAmountValue ?? financial.depositAmountNumber);
  const rent = text(financial.amountNumber);
  return {
    facts: [
      {
        label: isLandlord ? 'Người thuê' : 'Chủ nhà',
        icon: 'person-outline',
        value: text(counterpart.fullName),
      },
      {
        label: 'Địa điểm thuê',
        icon: 'location-outline',
        value: title ?? address,
        sub: title && address ? address : undefined,
      },
      {
        label: 'Tiền thuê · Tiền cọc',
        icon: 'cash-outline',
        value: rent,
        sub: rent
          ? `Cọc: ${zeroDeposit ? 'không đặt cọc' : (text(financial.depositAmountNumber) ?? '—')}`
          : undefined,
      },
      {
        label: 'Thời hạn thuê',
        icon: 'calendar-outline',
        value:
          text(lease.startDateText) && leaseEnd
            ? `${text(lease.startDateText)} – ${leaseEnd}`
            : undefined,
      },
    ],
    cards: [
      {
        title: 'Các bên',
        rows: [
          ['Chủ nhà (Bên A)', text(landlord.fullName)],
          ['Người thuê (Bên B)', text(tenant.fullName)],
          [isLandlord ? 'Điện thoại người thuê' : 'Điện thoại chủ nhà', text(counterpart.phone)],
        ],
      },
      {
        title: 'Địa điểm thuê',
        rows: [
          ['Địa chỉ', address],
          ['Loại hình', text(property.propertyType)],
          ['Diện tích', text(property.areaText)],
          ['Số căn / phòng', text(property.unitNumber)],
          ['Tầng', text(property.floor)],
        ],
      },
      {
        title: 'Thời hạn thuê',
        rows: [
          ['Bắt đầu', text(lease.startDateText)],
          ['Kết thúc', leaseEnd],
          [
            'Thời hạn',
            earlyEnd
              ? 'Rút ngắn theo phụ lục chấm dứt sớm'
              : (text(lease.durationText) ??
                (text(lease.durationMonths) ? `${text(lease.durationMonths)} tháng` : undefined)),
          ],
          ['Bàn giao', text(lease.handoverDateText)],
        ],
      },
      {
        title: 'Tiền thuê & cọc',
        rows: [
          ['Tiền thuê', rent],
          ['Tiền cọc', zeroDeposit ? 'Không đặt cọc' : text(financial.depositAmountNumber)],
          ['Kỳ thanh toán', text(financial.paymentCycle)],
          ['Phương thức', text(financial.paymentMethod)],
        ],
      },
    ],
  };
}

export const shownRows = <T extends string | undefined>(rows: [string, T][]) =>
  rows.filter(([, v]) => v !== undefined && v !== '' && v !== '—');

// ---------------------------------------------------------------- header (HD:92-117, :180-201)

export function headerPill(
  contract: Pick<ContractResponse, 'status' | 'agreementKind'>,
  statusLabel: string,
  cancellationRefundPending?: boolean
) {
  if (cancellationRefundPending) return 'Chờ xác nhận hoàn tiền';
  if (contract.agreementKind === 'AMENDMENT' && contract.status === 'ACTIVE')
    return 'Đã ký đủ phụ lục';
  return statusLabel;
}

export function paymentLine(contract: Pick<ContractResponse, 'agreementKind' | 'paymentStatus'>) {
  if (contract.agreementKind === 'AMENDMENT')
    return { text: 'Thanh toán theo hợp đồng gốc', tone: 'neutral' as const };
  return contract.paymentStatus === 'PAID' || contract.paymentStatus === 'PAID_MOCK'
    ? { text: 'Đã hoàn tất thanh toán ban đầu', tone: 'success' as const }
    : { text: 'Chưa thanh toán', tone: 'warning' as const };
}

export function documentButtons(
  contract: Pick<
    ContractResponse,
    'status' | 'agreementKind' | 'parentContractId' | 'agreedEarlyEndExclusive'
  >,
  latest: ContractDocumentResponse | null
) {
  const signedAppendix = Boolean(
    contract.parentContractId &&
    contract.agreementKind === 'AMENDMENT' &&
    contract.status === 'ACTIVE'
  );
  const effective = contract.status === 'ACTIVE' && (!contract.parentContractId || signedAppendix);
  const verified = requiresVerifiedContent(latest);
  const viewLabel = effective
    ? contract.agreedEarlyEndExclusive
      ? 'Xem phụ lục chấm dứt đang áp dụng'
      : 'Xem hợp đồng đang áp dụng'
    : latest?.purpose === 'SIGNED_FINAL'
      ? 'Xem bản đã ký'
      : latest?.purpose === 'SIGNED_LANDLORD'
        ? 'Xem bản đang ký'
        : 'Xem bản soạn thảo';
  const downloadLabel = effective
    ? contract.agreedEarlyEndExclusive
      ? 'Tải phụ lục chấm dứt đang áp dụng'
      : 'Tải PDF đang áp dụng'
    : latest?.purpose === 'SIGNED_FINAL'
      ? 'Tải PDF đã ký'
      : `Tải bản ${latest?.documentType}`;
  return {
    signedAppendix,
    effective,
    view: effective || verified || Boolean(latest?.viewUrl) ? viewLabel : null,
    download: effective || verified || Boolean(latest?.downloadUrl) ? downloadLabel : null,
    ownAppendix: Boolean(
      signedAppendix && latest && (latest.storageObjectId || latest.viewUrl || latest.downloadUrl)
    ),
  };
}

export const EFFECTIVE_OPEN_FAILED =
  'Chưa tải được PDF đã ký của hợp đồng đang áp dụng. Vui lòng thử lại; hệ thống không mở thay bằng bản cũ.';
export const DOCUMENT_OPEN_FAILED =
  'Chưa mở được tài liệu hiện tại. Hãy tải lại hồ sơ rồi thử lại.';

/** HD:107-124: every open reads the server again and never falls back to an older file. */
export async function readFreshDocument(
  input: {
    contractId: string;
    /** The "đang áp dụng" document; false = exactly `latest`. */
    effective: boolean;
    latest: ContractDocumentResponse | null;
    download: boolean;
  },
  io: {
    getEffectiveDocument: (id: string) => Promise<ContractDocumentResponse | null>;
    getDocument: (id: string) => Promise<ContractDocumentResponse>;
  }
): Promise<ContractDocumentResponse> {
  const { contractId, effective, latest, download } = input;
  const fresh = effective
    ? await io.getEffectiveDocument(contractId)
    : await io.getDocument(latest!.id);
  if (
    !fresh ||
    fresh.status !== 'READY' ||
    (effective
      ? fresh.purpose !== 'SIGNED_FINAL' || fresh.documentType !== 'PDF'
      : fresh.id !== latest!.id || fresh.contractId !== contractId) ||
    (!requiresVerifiedContent(fresh) &&
      !(download ? fresh.downloadUrl : fresh.viewUrl || fresh.downloadUrl))
  )
    throw new Error(effective ? EFFECTIVE_OPEN_FAILED : DOCUMENT_OPEN_FAILED);
  return fresh;
}

// ---------------------------------------------------------------- draft action bar (HD:234-281)

export function showDraftBar(input: {
  isLandlord: boolean;
  status: string;
  cancellationRefundPending: boolean;
  amendmentEditing: boolean;
  hasReadyDoc: boolean;
  smartCaMode: boolean;
  hasListingSync: boolean;
}) {
  return (
    input.isLandlord &&
    input.status === 'DRAFT' &&
    !input.cancellationRefundPending &&
    !input.amendmentEditing &&
    (!input.hasReadyDoc || !input.smartCaMode || input.hasListingSync)
  );
}

export function draftBarText(hasReadyDoc: boolean, review?: { retry: boolean }) {
  if (hasReadyDoc) return 'Bản xem trước đã sẵn sàng.';
  if (review?.retry) return 'Bản nháp đã lưu. Bạn có thể thử kết xuất lại PDF.';
  return review
    ? 'Lưu nội dung đã rà soát và tự tạo PDF để kiểm tra trước khi ký.'
    : 'Kết xuất PDF để kiểm tra và tiếp tục ký ở đầu trang.';
}

type BusyFlags = { rendering: boolean; reconciling: boolean; sending: boolean };

export function renderButton(
  input: BusyFlags & {
    review?: { saving: boolean; retry: boolean; locked: boolean };
    gateAllowed: boolean;
  }
) {
  const { review, rendering, reconciling, sending } = input;
  return {
    label: review?.saving
      ? 'Đang lưu bản nháp...'
      : reconciling
        ? 'Đang kiểm tra kết quả...'
        : rendering
          ? 'Đang kết xuất...'
          : review?.retry
            ? 'Thử kết xuất lại'
            : review
              ? 'Lưu'
              : 'Kết xuất file',
    spinning: Boolean(rendering || review?.saving),
    disabled: Boolean(
      rendering || reconciling || sending || review?.saving || review?.locked || !input.gateAllowed
    ),
  };
}

export function sendButton(
  input: BusyFlags & {
    complete: boolean;
    hasReadyDoc: boolean;
    gateTitle?: string;
  }
) {
  const reason =
    input.gateTitle ??
    (!input.complete
      ? 'Bổ sung đủ trường trước khi gửi'
      : !input.hasReadyDoc
        ? 'Kết xuất file hợp đồng trước khi gửi'
        : undefined);
  return {
    label: input.sending ? 'Đang gửi...' : 'Gửi cho người thuê',
    disabled: Boolean(input.rendering || input.reconciling || input.sending || reason),
    reason,
  };
}

// ---------------------------------------------------------------- draft form validity (DV:325)

/**
 * Stands in for the web's `form.reportValidity()` on the editable inputs of the draft: the HTML
 * required/min/max/step, type="email" and the account-number pattern (only once changed).
 * Meters, fee and phone have their own checks (validateDraft). Keys are "<party>.<field>".
 */
export function draftFieldErrors(base: AmendmentTerms, values: AmendmentTerms) {
  const errors: Record<string, string> = {};
  for (const group of ['landlord', 'tenant'] as const) {
    const row = values[group] ?? {};
    const email = String(row.email ?? '');
    if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) errors[`${group}.email`] = 'Email không hợp lệ.';
    const account = String(row.bankAccountNumber ?? '');
    if (
      account &&
      account !== String(base[group]?.bankAccountNumber ?? '') &&
      !/^[0-9]{1,34}$/.test(account)
    )
      errors[`${group}.bankAccountNumber`] = 'Số tài khoản gồm 1 đến 34 chữ số.';
  }
  for (const key of ['occupantCount', 'motorbikeCount', 'carCount']) {
    const raw = String(values.tenant?.[key] ?? '').trim();
    const { min, max } = amendmentNumbers[key];
    const n = Number(raw);
    if (!raw || !Number.isInteger(n) || n < min || n > max)
      errors[`tenant.${key}`] = `Nhập số nguyên từ ${min} đến ${max}.`;
  }
  return errors;
}

// ---------------------------------------------------------------- save + render (DV:327-403)

/** A saved draft is a new current revision: signing and the document list filter by it. */
export function withSavedRevision<T extends Pick<ContractResponse, 'id' | 'currentRevisionId'>>(
  contract: T | null,
  revision: Pick<ContractRevisionResponse, 'id' | 'contractId'>
): T | null {
  return contract?.id === revision.contractId
    ? { ...contract, currentRevisionId: revision.id }
    : contract;
}

export interface RenderTransport {
  updateRevision: (
    contractId: string,
    payload: UpdateContractRevisionRequest,
    signal: AbortSignal
  ) => Promise<ContractRevisionResponse>;
  triggerPreview: (
    contractId: string,
    signal: AbortSignal,
    expectedRevisionId?: string
  ) => Promise<ContractDocumentResponse>;
  getPreviewStatus: (
    contractId: string,
    signal: AbortSignal
  ) => Promise<ContractDocumentResponse | null>;
  getCompleteness: (contractId: string) => Promise<ContractCompletenessResponse>;
  getDocuments: (contractId: string) => Promise<ContractDocumentResponse[]>;
}

export type RenderEvent =
  | { type: 'saving' }
  | { type: 'saved'; revision: ContractRevisionResponse }
  | { type: 'rendering' }
  | { type: 'reconciling' }
  /** `doc` null = the result is unknown, not failed. */
  | { type: 'preview'; doc: ContractDocumentResponse | null; message: string }
  | { type: 'failed'; conflict: boolean; retry: boolean; message: string }
  | {
      type: 'refreshed';
      completeness?: ContractCompletenessResponse;
      documents?: (previous: ContractDocumentResponse[]) => ContractDocumentResponse[];
    };

/**
 * Saves the reviewed draft (when `payload` is given), then renders the preview: one POST, an
 * uncertain answer reconciled by polling preview-status. Nothing is emitted after an abort.
 * `isCurrent` is the web's `previewRequest.current === request`.
 */
export async function runDraftRender(
  io: RenderTransport,
  input: {
    contractId: string;
    revision: ContractRevisionResponse;
    payload: UpdateContractRevisionRequest | null;
    reviewDraft: boolean;
  },
  signal: AbortSignal,
  isCurrent: () => boolean,
  emit: (event: RenderEvent) => void,
  options: { wait?: (ms: number, signal: AbortSignal) => Promise<void> } = {}
): Promise<void> {
  const { contractId, payload, reviewDraft } = input;
  let target = input.revision;
  let draftSaved = false;
  let previewReady = false;
  try {
    if (payload) {
      emit({ type: 'saving' });
      target = await io.updateRevision(contractId, payload, signal);
      if (signal.aborted) return;
      draftSaved = true;
      emit({ type: 'saved', revision: target });
    }
    emit({ type: 'rendering' });
    const doc = await generateContractPreview(
      {
        trigger: (s) => io.triggerPreview(contractId, s, reviewDraft ? target.id : undefined),
        status: (s) => io.getPreviewStatus(contractId, s),
      },
      target.id,
      signal,
      () => emit({ type: 'reconciling' }),
      { requirePdf: reviewDraft, wait: options.wait }
    );
    if (signal.aborted) return;
    previewReady = Boolean(doc);
    emit({
      type: 'preview',
      doc,
      message: doc
        ? draftSaved
          ? 'Đã lưu và kết xuất PDF. Bạn có thể xem lại trước khi ký.'
          : 'Đã tạo bản xem trước hợp đồng.'
        : draftSaved
          ? 'Đã lưu bản nháp. Chưa xác nhận được kết quả kết xuất PDF.'
          : 'Chưa xác nhận được kết quả kết xuất. Bạn có thể thử kết xuất lại.',
    });
  } catch (error) {
    if (signal.aborted) return;
    const message = getApiErrorMessage(
      error,
      payload && !draftSaved ? 'Không thể lưu bản nháp.' : 'Không thể kết xuất bản xem trước.'
    );
    emit({
      type: 'failed',
      conflict: isDraftConflictError(error),
      retry: reviewDraft && (!payload || draftSaved),
      message: draftSaved ? 'Đã lưu bản nháp. ' + message : message,
    });
  } finally {
    if (isCurrent() && (draftSaved || previewReady)) {
      const [completeness, documents] = await Promise.allSettled([
        io.getCompleteness(contractId),
        io.getDocuments(contractId),
      ]);
      if (!signal.aborted)
        emit({
          type: 'refreshed',
          completeness:
            completeness.status === 'fulfilled' && completeness.value.revisionId === target.id
              ? completeness.value
              : undefined,
          documents:
            documents.status === 'fulfilled'
              ? (previous) => [
                  ...documents.value,
                  ...previous.filter(
                    (d) =>
                      d.revisionId === target.id &&
                      !documents.value.some((item) => item.id === d.id)
                  ),
                ]
              : undefined,
        });
    }
  }
}

// ---------------------------------------------------------------- missing fields (ContractMissingFieldsNotice.tsx:14-44)

const KYC_FIELDS = [
  'fullName',
  'idNumber',
  'birthDate',
  'gender',
  'permanentAddress',
  'issueDate',
  'expirationDate',
  'issuePlace',
];

export function missingFieldsSummary(input: {
  completeness: ContractCompletenessResponse | null;
  isLandlord: boolean;
  meterFields?: string[];
  hasLandlordPhone?: boolean;
}) {
  const incomplete = input.completeness && !input.completeness.complete ? input.completeness : null;
  const { meterFields } = input;
  const listed = (incomplete?.missingFields ?? []).filter(
    (field) =>
      !(meterFields && ['meters.electricityInitial', 'meters.waterInitial'].includes(field.key)) &&
      !(input.hasLandlordPhone && field.key === 'landlord.phone')
  );
  const count = listed.length + (meterFields?.length ?? 0);
  return {
    count,
    filled: incomplete ? Math.max(0, incomplete.totalFields - count) : null,
    total: incomplete?.totalFields ?? null,
    hasMeterEditor: Boolean(meterFields?.length),
    listed,
    kycLink:
      input.isLandlord &&
      listed.some(
        (field) => field.key.startsWith('landlord.') && KYC_FIELDS.includes(field.key.split('.')[1])
      ),
  };
}
