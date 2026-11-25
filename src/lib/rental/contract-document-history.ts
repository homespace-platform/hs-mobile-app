// Port of hs-web-app lib/contract-document-history.ts (Hermes-safe Vietnam-time formatting from ./format).
import { vnDateKey, vnShortDateTime } from '@/lib/rental/format';
import type {
  ContractDocumentResponse,
  SignatureRequestResponse,
} from '@/types/rental/contract.type';
import type { AmendmentProposal } from '@/types/rental/contract-amendment.type';

export function requiresVerifiedContent(doc?: ContractDocumentResponse | null): boolean {
  return doc?.documentType === 'PDF' && doc.purpose === 'SIGNED_FINAL' && doc.status === 'READY';
}

export function documentTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa ghi nhận thời điểm';
  return vnShortDateTime(value);
}
export function documentDate(value?: string | null): string {
  if (!value) return 'Chưa xác định';
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : 'Chưa xác định';
}
export function sortedDocuments(rows: ContractDocumentResponse[]): ContractDocumentResponse[] {
  return [...rows].sort(
    (a, b) =>
      (Date.parse(b.generatedAt ?? '') || 0) - (Date.parse(a.generatedAt ?? '') || 0) ||
      b.id.localeCompare(a.id)
  );
}
export function primaryDocument(
  rows: ContractDocumentResponse[],
  signed: boolean,
  revisionId?: string | null
): ContractDocumentResponse | undefined {
  const ready = sortedDocuments(rows).filter(
    (d) =>
      d.status === 'READY' &&
      d.documentType === 'PDF' &&
      (!revisionId || d.revisionId === revisionId)
  );
  if (signed) return ready.find((d) => d.purpose === 'SIGNED_FINAL');
  return (
    ready.find((d) => d.purpose === 'SIGNED_LANDLORD') ??
    ready.find((d) => d.purpose === 'OFFICIAL') ??
    ready.find((d) => d.purpose === 'PREVIEW')
  );
}
export function visibleDocument(
  rows: ContractDocumentResponse[],
  signed: boolean,
  revisionId?: string | null
): ContractDocumentResponse | undefined {
  const ready = sortedDocuments(rows).filter(
    (d) =>
      d.status === 'READY' &&
      (revisionId === undefined || (revisionId !== null && d.revisionId === revisionId))
  );
  const current =
    revisionId === undefined ? ready.filter((d) => d.revisionId === ready[0]?.revisionId) : ready;
  if (signed) return current.find((d) => d.documentType === 'PDF' && d.purpose === 'SIGNED_FINAL');
  return (
    current.find((d) => d.documentType === 'PDF' && d.purpose === 'SIGNED_FINAL') ??
    current.find((d) => d.documentType === 'PDF' && d.purpose === 'SIGNED_LANDLORD') ??
    current.find((d) => d.documentType === 'PDF' && d.purpose === 'OFFICIAL') ??
    current.find((d) => d.documentType === 'PDF' && d.purpose === 'PREVIEW') ??
    current.find((d) => d.documentType === 'DOCX')
  );
}
export function documentStage(doc: ContractDocumentResponse): string {
  if (doc.documentType === 'DOCX') return 'Word soạn thảo · Không phải bản ký';
  return (
    {
      SIGNED_FINAL: 'PDF đã ký đủ hai bên',
      SIGNED_LANDLORD: 'PDF chủ nhà đã ký · Chưa đủ hai bên',
      OFFICIAL: 'PDF trước khi ký',
      PREVIEW: 'PDF bản xem trước',
    }[doc.purpose] ?? 'Tài liệu lưu trữ'
  );
}
export const closedDocumentProposals = new Set(['REJECTED', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED']);
export function concreteProposals(rows: AmendmentProposal[]): AmendmentProposal[] {
  // API history is audit-createdAt DESC. Preserve that order: simulated signing/submission
  // clocks can repeat or move backwards and must not renumber older signed adjustments.
  return rows.filter((p) => !p.status.startsWith('TENANT_')).reverse();
}
export function signedAmendment(p: AmendmentProposal): boolean {
  return Boolean(p.signedAt && ['APPLIED', 'SCHEDULED', 'SUPERSEDED'].includes(p.status));
}
export function appliedAmendment(p: AmendmentProposal, serverNow: string): boolean {
  if (!signedAmendment(p) || p.status !== 'APPLIED' || !Number.isFinite(Date.parse(serverNow)))
    return false;
  const today = vnDateKey(serverNow);
  return p.effectiveOn <= today;
}
export function amendmentDocumentStatus(p: AmendmentProposal, serverNow: string): string {
  if (appliedAmendment(p, serverNow)) return 'Đã áp dụng từ ' + documentDate(p.effectiveOn);
  if (p.status === 'APPLIED') return 'Đang kiểm tra mốc áp dụng';
  if (p.status === 'SCHEDULED' && p.signedAt) return 'Đã ký đủ · Chờ áp dụng';
  if (p.status === 'APPROVED')
    return p.agreementStatus === 'TENANT_SIGNATURE_PENDING'
      ? 'Chờ người thuê ký'
      : 'Chờ chủ nhà ký';
  if (p.status === 'SUPERSEDED' && p.signedAt) return 'Đã được thay thế · Không áp dụng';
  return (
    (
      {
        REQUESTED: 'Chờ người thuê duyệt',
        CHANGES_REQUESTED: 'Cần chỉnh lại đề xuất',
        REJECTED: 'Đã từ chối · Không áp dụng',
        WITHDRAWN: 'Đã rút · Không áp dụng',
        EXPIRED: 'Đã hết hạn · Không áp dụng',
        SUPERSEDED: 'Đã thay bằng đề xuất khác',
      } as Record<string, string>
    )[p.status] ?? 'Chưa áp dụng'
  );
}
export function amendmentDocumentTitle(p: AmendmentProposal): string {
  const names = new Set(
    p.comparison.map((r) =>
      r.field === 'rentAmount'
        ? 'Giá thuê'
        : r.field.startsWith('policies.latePayment')
          ? 'Phí chậm trả'
          : r.label
    )
  );
  const labels = [...names];
  return (
    labels.slice(0, 2).join(' · ') +
      (labels.length > 2 ? ` và ${labels.length - 2} nội dung khác` : '') || 'Điều chỉnh điều khoản'
  );
}
export function verifiedSignatureTimes(
  rows: SignatureRequestResponse[],
  revisionId?: string
): { landlord?: string; tenant?: string } {
  const valid = rows
    .filter(
      (r) => r.status === 'SIGNED' && r.confirmedAt && (!revisionId || r.revisionId === revisionId)
    )
    .sort((a, b) => Date.parse(b.confirmedAt!) - Date.parse(a.confirmedAt!));
  return {
    landlord: valid.find((r) => r.signerRole === 'LANDLORD')?.confirmedAt ?? undefined,
    tenant: valid.find((r) => r.signerRole === 'TENANT')?.confirmedAt ?? undefined,
  };
}
