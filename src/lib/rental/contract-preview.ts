// Port of hs-web-app lib/contract-preview.ts (AbortSignal.throwIfAborted/reason replaced: React Native's polyfill has neither).
import type { ContractDocumentResponse } from '@/types/rental/contract.type';

/** `signal.throwIfAborted()` for React Native's abort-controller polyfill, which has no such method. */
export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason(signal);
}
function abortReason(signal: AbortSignal): unknown {
  const reason = (signal as { reason?: unknown }).reason;
  if (reason !== undefined) return reason;
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

export function isUncertainPreviewError(error: unknown): boolean {
  const err = error as { response?: { status?: number }; code?: string } | null;
  if (!err || typeof err !== 'object') return false;
  return (
    [502, 503, 504].includes(err.response?.status ?? 0) ||
    (!err.response && ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(err.code ?? ''))
  );
}

export interface PreviewTransport {
  trigger: (signal: AbortSignal) => Promise<ContractDocumentResponse>;
  status: (signal: AbortSignal) => Promise<ContractDocumentResponse | null>;
}

const sleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    const abort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });

/** POST once. An uncertain transport result is reconciled only with read-only requests. */
export async function generateContractPreview(
  transport: PreviewTransport,
  revisionId: string,
  signal: AbortSignal,
  onReconciling: () => void,
  options: {
    attempts?: number;
    wait?: (ms: number, signal: AbortSignal) => Promise<void>;
    requirePdf?: boolean;
  } = {}
): Promise<ContractDocumentResponse | null> {
  const matches = (doc: ContractDocumentResponse | null) =>
    doc?.status === 'READY' &&
    doc.revisionId === revisionId &&
    doc.storageObjectId &&
    (!options.requirePdf || doc.documentType === 'PDF');
  throwIfAborted(signal);
  try {
    const doc = await transport.trigger(signal);
    throwIfAborted(signal);
    if (matches(doc)) return doc;
  } catch (error) {
    throwIfAborted(signal);
    if (!isUncertainPreviewError(error)) throw error;
  }
  onReconciling();
  for (let attempt = 0; attempt < (options.attempts ?? 20); attempt++) {
    throwIfAborted(signal);
    try {
      const doc = await transport.status(signal);
      throwIfAborted(signal);
      if (matches(doc)) return doc;
    } catch (error) {
      throwIfAborted(signal);
      if (!isUncertainPreviewError(error)) throw error;
    }
    if (attempt + 1 < (options.attempts ?? 20)) await (options.wait ?? sleep)(3000, signal);
  }
  return null; // Unknown is not failure. A subsequent explicit click safely reuses server result.
}
