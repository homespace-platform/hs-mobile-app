// Decision rules cut out of the web contract signing/document components. Pure, so
// tests/rental-contract-signing.test.cjs can run them side by side with the web source.
import { primaryDocument, requiresVerifiedContent } from '@/lib/rental/contract-document-history';
import { numberVi } from '@/lib/rental/format';
import type {
  ContractBlockchainProofResponse,
  ContractBlockchainVerificationResponse,
} from '@/types/rental/blockchain.type';
import type {
  CertificateOptionResponse,
  ContractDocumentResponse,
  ContractResponse,
  SignatureRequestResponse,
  SignatureStateResponse,
} from '@/types/rental/contract.type';

// ---- SmartCaSignaturePanel.tsx ----

const IN_PROGRESS = new Set([
  'CREATED',
  'PENDING_USER_CONFIRMATION',
  'PROVIDER_SIGNED',
  'EMBEDDING',
]);

export const signatureInProgress = (status?: string | null) => IN_PROGRESS.has(status ?? '');

export type LocalSignatureRequest = {
  contractId: string;
  /** `state.activeRequest` at the time the local request was received. */
  source: SignatureStateResponse['activeRequest'];
  request: SignatureRequestResponse;
};

/** :42-44. Fresh server state (a new `activeRequest` reference) replaces the locally held answer. */
export function currentSignatureRequest(
  local: LocalSignatureRequest | null,
  contractId: string,
  state: SignatureStateResponse
): SignatureRequestResponse | null {
  return local?.contractId === contractId && local.source === state.activeRequest
    ? local.request
    : (state.activeRequest ?? null);
}

/**
 * Mobile only: this side's signature of this revision is verified but the contract on screen has not
 * caught up yet, so the form must not come back.
 */
export const signedAwaitingContract = (
  request: SignatureRequestResponse | null,
  contract: Pick<ContractResponse, 'currentRevisionId'>,
  isLandlord: boolean
) =>
  request?.status === 'SIGNED' &&
  request.signerRole === (isLandlord ? 'LANDLORD' : 'TENANT') &&
  request.revisionId === contract.currentRevisionId;

export type SmartCaView =
  | {
      kind: 'ended' | 'disabled' | 'active' | 'failed' | 'finished' | 'blocked' | 'waiting';
      message: string;
    }
  | { kind: 'sign'; pending: boolean };

/** :106-146. The branches are tested in exactly the web's order (C-240…C-247). */
export function smartCaView({
  contract,
  smartCaEnabled,
  request,
  isLandlord,
  isTenant,
  signingAllowed,
  blockedReason,
}: {
  contract: Pick<ContractResponse, 'status' | 'agreementKind'>;
  smartCaEnabled: boolean;
  request: SignatureRequestResponse | null;
  isLandlord: boolean;
  isTenant: boolean;
  signingAllowed: boolean;
  blockedReason?: string;
}): SmartCaView {
  const { status } = contract;
  const myTurn =
    (isLandlord && status === 'DRAFT') || (isTenant && status === 'TENANT_SIGNATURE_PENDING');
  const pending = signatureInProgress(request?.status);

  if (['EXPIRED', 'CLOSED', 'TERMINATED', 'CANCELLED'].includes(status))
    return {
      kind: 'ended',
      message:
        status === 'EXPIRED'
          ? 'Hợp đồng đã hết thời hạn thuê. Tiếp tục hoàn tất hóa đơn, bàn giao và hoàn cọc bên dưới; không cần ký lại hợp đồng gốc.'
          : status === 'CLOSED'
            ? 'Hợp đồng đã hoàn tất quyết toán. PDF đã ký được giữ nguyên để tra cứu.'
            : status === 'TERMINATED'
              ? 'Hợp đồng đã chấm dứt. Không còn bước chờ ký số.'
              : 'Hợp đồng đã hủy. Không còn bước chờ ký số.',
    };
  if (!smartCaEnabled)
    return {
      kind: 'disabled',
      message:
        'Chế độ SmartCA đã được chọn nhưng kết nối VNPT chưa bật trên máy chủ. Vui lòng liên hệ quản trị viên.',
    };
  if (status === 'ACTIVE')
    return {
      kind: 'active',
      message:
        contract.agreementKind === 'AMENDMENT'
          ? 'Hai bên đã ký đủ phụ lục. Xem trạng thái và ngày áp dụng ở bảng điều chỉnh phía trên.'
          : 'Hai bên đã ký số. Hãy tải PDF hoàn chỉnh để kiểm tra chữ ký.',
    };
  if (request?.status === 'FAILED' && (!myTurn || request.failureCode === 'PROVIDER_STATE_UNKNOWN'))
    return {
      kind: 'failed',
      message: `${request.failureReason || 'Xử lý chữ ký số thất bại.'} Không gửi yêu cầu ký mới cho tới khi giao dịch cũ được đối soát.`,
    };
  if (request && ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(request.status) && !myTurn)
    return {
      kind: 'finished',
      message:
        request.failureReason ||
        'Yêu cầu ký đã kết thúc mà chưa có chữ ký. Hãy tải lại trạng thái hợp đồng để tiếp tục.',
    };
  if (!signingAllowed && !pending)
    return {
      kind: 'blocked',
      message: blockedReason || 'Chưa đủ điều kiện ký. Xem tiến trình nhận nhà phía trên.',
    };
  if (!myTurn && !pending)
    return {
      kind: 'waiting',
      message:
        isLandlord && status === 'TENANT_SIGNATURE_PENDING'
          ? 'Chủ nhà đã ký số. Đang chờ người thuê ký cùng bản PDF.'
          : 'Hợp đồng đang chờ bên còn lại hoàn tất bước ký số.',
    };
  return { kind: 'sign', pending };
}

/**
 * :89-90: a single certificate is selected for the signer. Mobile only: a serial that is no longer in
 * the reloaded list is dropped (the web `<select>` would show nothing but still send it).
 */
export function selectedSerial(options: CertificateOptionResponse[], previous: string) {
  if (options.length === 1) return options[0].serialNumber;
  return options.some((option) => option.serialNumber === previous) ? previous : '';
}

// ---- what a consent is about (mobile only, stricter than web) ----

type SignedContract = Pick<ContractResponse, 'id' | 'status' | 'currentRevisionId'>;

/**
 * Identity of what the signer agrees to: signer, contract, revision and the file(s) of this turn the
 * server may sign (SmartCaSignatureServiceImpl.findSigningSourcePdf). All candidates count, since
 * the client cannot tell which one the server takes. Null while that file is unknown.
 */
export function signingSource(
  documents: ContractDocumentResponse[],
  contract: SignedContract,
  mode: SignatureStateResponse['signatureMode'],
  signerId: string
): string | null {
  const smartCa = mode === 'SMARTCA';
  const purposes =
    smartCa && contract.status === 'TENANT_SIGNATURE_PENDING'
      ? ['SIGNED_LANDLORD']
      : ['PREVIEW', 'OFFICIAL'];
  const ids = documents
    .filter(
      (d) =>
        d.contractId === contract.id &&
        d.revisionId === contract.currentRevisionId &&
        d.status === 'READY' &&
        purposes.includes(d.purpose) &&
        // INTERNAL previews are DOCX when the server has no PDF converter.
        (!smartCa || d.documentType === 'PDF')
    )
    .map((d) => d.id)
    .sort();
  if (!ids.length || !contract.currentRevisionId) return null;
  return [signerId, contract.id, contract.currentRevisionId, ...ids].join('|');
}

// ---- rental-request/WorkflowDocumentsPanel.tsx (mobile only, stricter than web) ----

/**
 * The row on screen. A requested document is only ever shown as itself, also while the list is
 * loading or failed to load; another row appears only once the viewer picks it.
 */
export function workflowRow<T extends { signingContractId: string; current: boolean }>(
  rows: T[],
  selected: string,
  agreementId?: string
): T | undefined {
  const match = rows.find((r) => r.signingContractId === selected);
  if (agreementId && selected === agreementId) return match;
  return match ?? rows.find((r) => r.current) ?? rows[0];
}

/** This agreement's current-revision PDF that fits its signing stage; no "any ready PDF" fallback. */
export function workflowPdf(
  documents: ContractDocumentResponse[],
  contract: SignedContract & Pick<ContractResponse, 'signedAt'>,
  rowSigned: boolean
): ContractDocumentResponse | undefined {
  if (!contract.currentRevisionId) return undefined;
  const signed = rowSigned || !!contract.signedAt || contract.status === 'ACTIVE';
  // On the tenant's turn the unsigned source is not what gets signed.
  const tenantTurn = !signed && contract.status === 'TENANT_SIGNATURE_PENDING';
  return primaryDocument(
    documents.filter(
      (d) => d.contractId === contract.id && (!tenantTurn || d.purpose === 'SIGNED_LANDLORD')
    ),
    signed,
    contract.currentRevisionId
  );
}

// ---- ContractSignaturePanel.tsx (INTERNAL mode) ----

export type InternalSignView =
  'active' | 'blocked' | 'landlord-draft' | 'tenant-pending' | 'landlord-pending' | null;

export function internalSignView({
  status,
  isLandlord,
  isTenant,
  signingAllowed,
}: {
  status: string;
  isLandlord: boolean;
  isTenant: boolean;
  signingAllowed: boolean;
}): InternalSignView {
  const draft = status === 'DRAFT';
  const pending = status === 'PENDING_REVIEW';
  if (status === 'ACTIVE') return 'active';
  if (!signingAllowed && (draft || pending)) return 'blocked';
  if (isLandlord && draft) return 'landlord-draft';
  if (isTenant && pending) return 'tenant-pending';
  if (isLandlord && pending) return 'landlord-pending';
  return null;
}

// ---- send / sign guard ----

/** Reads again right before a send or sign: nothing goes out unless the reviewed source is current. */
export async function submitIfCurrent(input: {
  stillCurrent: () => Promise<boolean>;
  isAlive: () => boolean;
  refuse: (reason: 'unreadable' | 'changed') => void;
  action: () => Promise<void>;
}): Promise<void> {
  let same: boolean;
  try {
    same = await input.stillCurrent();
  } catch {
    if (input.isAlive()) input.refuse('unreadable');
    return;
  }
  if (!input.isAlive()) return;
  if (!same) return input.refuse('changed');
  await input.action();
}

// ---- single flight ----

/** One call at a time (initiate, refresh, send, sign, open file): a second tap meanwhile is dropped. */
export function createSingleFlight() {
  let busy = false;
  return async (task: () => Promise<unknown>): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      await task();
    } finally {
      busy = false;
    }
  };
}

/**
 * ContractDetailView.tsx:173-208. One signed-state read at a time: callers arriving meanwhile share it
 * and get one fresh follow-up, even after a failed read, so an older answer never overwrites a newer
 * one. Create one per contract; `dispose()` on contract change/unmount drops late results.
 */
export function createSignedStateRefresh<T>(read: () => Promise<T>, apply: (value: T) => void) {
  let disposed = false;
  let dirty = false;
  let running: Promise<void> | null = null;
  return {
    refresh(): Promise<void> {
      if (disposed) return Promise.resolve();
      if (running) {
        dirty = true;
        return running;
      }
      let done = false;
      const run = (async () => {
        let failure: unknown;
        try {
          do {
            dirty = false;
            failure = undefined;
            try {
              const value = await read();
              if (disposed) return;
              apply(value);
            } catch (error) {
              failure = error;
            }
          } while (dirty && !disposed);
        } finally {
          done = true;
          running = null;
        }
        if (!disposed && failure) throw failure;
      })();
      if (!done) running = run;
      return run;
    },
    dispose() {
      disposed = true;
    },
  };
}

// ---- ContractBlockchainProof.tsx ----

/** :120-122. A verification answer counts only for the proof on screen. */
export function checkVerification(
  documentId: string,
  proof: ContractBlockchainProofResponse,
  result: ContractBlockchainVerificationResponse
): 'missing' | 'match' | 'mismatch' {
  if (
    result.documentId !== documentId ||
    result.onChainDocumentId !== proof.onChainDocumentId ||
    result.chainId !== proof.chainId ||
    result.registryAddress.toLowerCase() !== proof.registryAddress?.toLowerCase()
  )
    throw new Error('Kết quả không thuộc bằng chứng đang xem. Hãy tải lại và đối chiếu lại.');
  return !result.registered ? 'missing' : result.matches ? 'match' : 'mismatch';
}

/** Mobile only: `hashPdfForProof` keeps the web's browser wording; the app says it for a phone. */
const NATIVE_WORDING: Record<string, string> = {
  'Hãy chọn PDF không quá 20 MB để đối chiếu trong trình duyệt.':
    'Hãy chọn PDF không quá 20 MB để đối chiếu trên thiết bị.',
  'Trình duyệt chưa hỗ trợ tính hash ở địa chỉ này. Hãy dùng HTTPS hoặc localhost.':
    'Thiết bị chưa tính được hash của tệp. Hãy thử lại hoặc cài bản ứng dụng mới nhất.',
};

/** :124. A network failure is never presented as a hash mismatch. */
export function verificationFailureMessage(failure: unknown): string {
  return failure instanceof Error && !('isAxiosError' in failure)
    ? (NATIVE_WORDING[failure.message] ?? failure.message)
    : 'Chưa đối chiếu được với blockchain. Hãy thử lại; lỗi kết nối không phải kết quả hash không khớp.';
}

// ---- ContractDocumentSection.tsx ----

export function fileSize(bytes?: number | null) {
  if (bytes == null) return 'Chưa có dung lượng';
  if (bytes < 1024) return `${bytes} B`;
  const oneDecimal = (value: number) => numberVi(Math.round(value * 10) / 10);
  return bytes < 1048576 ? `${oneDecimal(bytes / 1024)} KB` : `${oneDecimal(bytes / 1048576)} MB`;
}

export const isDocx = (doc: ContractDocumentResponse) =>
  doc.documentType?.toUpperCase() === 'DOCX' || !!doc.fileName?.toLowerCase().endsWith('.docx');

export const isPdf = (doc: ContractDocumentResponse) =>
  doc.documentType?.toUpperCase() === 'PDF' || !!doc.fileName?.toLowerCase().endsWith('.pdf');

export const OPEN_FAILED = 'Không mở được tệp. Vui lòng tải lại hồ sơ hoặc thử lại.';

export type DocumentOpenPlan =
  /** Verified bytes through `POST …/content?download=true`. */
  | { kind: 'verified-download' }
  /** Download the short-lived URL and hand it to the phone's apps. */
  | { kind: 'external'; url: string }
  /** The in-app PDF viewer. */
  | { kind: 'preview' };

/**
 * ContractDocumentSection.tsx `action`: what to do with `fresh`, the just re-read document of
 * `requested`. Throws the web message when the answer cannot be trusted or has nothing to open.
 * Mobile only (C-266): "Xem" on a DOCX opens the file with the phone's apps.
 */
export function documentOpenPlan(
  requested: ContractDocumentResponse,
  fresh: ContractDocumentResponse | null | undefined,
  download: boolean
): DocumentOpenPlan {
  if (
    !fresh ||
    fresh.id !== requested.id ||
    fresh.contractId !== requested.contractId ||
    !['READY', 'STALE'].includes(fresh.status) ||
    (!requiresVerifiedContent(fresh) &&
      !(download ? fresh.downloadUrl : fresh.viewUrl || fresh.downloadUrl))
  )
    throw new Error(OPEN_FAILED);
  if (download && requiresVerifiedContent(fresh)) return { kind: 'verified-download' };
  if (download && !requiresVerifiedContent(requested))
    return { kind: 'external', url: fresh.downloadUrl! };
  if (!requiresVerifiedContent(fresh) && isDocx(fresh))
    return { kind: 'external', url: (fresh.viewUrl || fresh.downloadUrl)! };
  return { kind: 'preview' };
}

/**
 * The URL of an unsigned file, from a metadata read made for this very attempt (a stored one may
 * have expired). Refuses another file or revision, one that went stale, and a signed final PDF,
 * which is only ever drawn from verified bytes.
 */
export function freshPreviewUrl(
  requested: ContractDocumentResponse,
  fresh: ContractDocumentResponse | null | undefined
): string {
  documentOpenPlan(requested, fresh, false);
  const next = fresh!;
  const url = next.viewUrl || next.downloadUrl;
  if (
    next.revisionId !== requested.revisionId ||
    (next.status !== 'READY' && requested.status === 'READY') ||
    requiresVerifiedContent(next) ||
    !url
  )
    throw new Error(OPEN_FAILED);
  return url;
}
