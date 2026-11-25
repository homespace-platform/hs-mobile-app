// Port of the pure parts of hs-web-app components/contract/detail/ContractAmendmentWorkspace.tsx (line
// numbers refer to it). The React state stays in the screen component.
//
// KEY ORDER MATTERS: change detection compares JSON.stringify output and the backend compares `changes` on an
// idempotent resend. Keep every spread, delete and assignment below in the web's order.
import { numberVi, vnDateTime } from '@/lib/rental/format';
import type { ContractListingSyncPreview } from '@/types/rental/contract.type';
import type {
  AmendmentPayload,
  AmendmentProposal,
  AmendmentTerms,
  ContractAmendments,
  TermRow,
} from '@/types/rental/contract-amendment.type';

// :15-19
export const amendmentMoney = (v: unknown) => numberVi(Number(v || 0)) + ' đ';
export const amendmentDate = (v: string) => v.split('-').reverse().join('/');
export const amendmentTime = (v?: string) => (v ? vnDateTime(v) : '—');
export const empty: AmendmentTerms = {
  financial: {},
  tenant: {},
  property: {},
  charges: [],
  equipments: [],
  amenities: [],
  policies: {},
  specialTerms: '',
};
export const activeAmendment = new Set([
  'REQUESTED',
  'CHANGES_REQUESTED',
  'APPROVED',
  'SCHEDULED',
  'TENANT_REQUESTED',
  'TENANT_ACCEPTED',
]);

// :21-40
export function restoreTerms(base: AmendmentTerms, change: TermRow): AmendmentTerms {
  const terms = structuredClone(base);
  for (const key of ['landlord', 'lease', 'meters', 'initialPayment'] as const)
    terms[key] = terms[key] ?? {};
  if (change.fields && typeof change.fields === 'object')
    for (const [key, row] of Object.entries(change.fields as TermRow)) {
      if (['landlord', 'tenant', 'property', 'lease', 'financial', 'policies'].includes(key)) {
        const group = key as
          'landlord' | 'tenant' | 'property' | 'lease' | 'financial' | 'policies';
        const locked =
          group === 'financial'
            ? ['paymentDueDay', 'paymentDueOffsetDays']
            : group === 'policies'
              ? ['latePaymentFeeGraceDays', 'latePaymentFeeCap', 'billingRules']
              : [];
        terms[group] = {
          ...terms[group],
          ...Object.fromEntries(
            Object.entries(row as TermRow).filter(([key]) => !locked.includes(key))
          ),
        };
      }
    }
  if (change.rentAmount !== undefined) terms.financial.amountValue = change.rentAmount;
  for (const key of ['occupantCount', 'motorbikeCount', 'carCount'])
    if (change[key] !== undefined) terms.tenant[key] = change[key];
  for (const key of ['charges', 'equipments', 'amenities'] as const)
    if (change[key]) terms[key] = structuredClone(change[key] as TermRow[]);
  if (change.policies)
    terms.policies = {
      ...terms.policies,
      ...Object.fromEntries(
        Object.entries(change.policies as TermRow).filter(
          ([key]) => !['latePaymentFeeGraceDays', 'latePaymentFeeCap', 'billingRules'].includes(key)
        )
      ),
    };
  if (change.policyRows)
    terms.policies.listingPolicies = (change.policyRows as TermRow[]).map((r) => ({
      code: r.code,
      label: r.label,
      valueType: 'TEXT',
      value: r.text,
      displayValue: r.text,
      note: '',
    }));
  if (change.specialTerms !== undefined) terms.specialTerms = String(change.specialTerms);
  if (change.featureRows) terms.property.features = structuredClone(change.featureRows);
  if (change.additionalTerms)
    terms.specialTerms += '\nTHỎA THUẬN BỔ SUNG:\n' + String(change.additionalTerms);
  return terms;
}

// :41-44
export function scheduledSource(
  rows: AmendmentProposal[],
  id?: string
): AmendmentProposal | undefined {
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const p = rows.find((p) => p.id === id);
    if (!p) return;
    if (p.status === 'SCHEDULED') return p;
    id = p.previousProposalId;
  }
}

/**
 * :89-105 (`start`): the form state of a new / reopened proposal, or `{ error }` (web shows it as a toast).
 * The caller also needs `requestId = randomUUID()` (expo-crypto), `draftBase = data.currentTermsRevisionId`,
 * and, when `listingSourceVersion` is set, re-reads the listing sync preview (:107-117).
 */
export function amendmentStart(
  data: ContractAmendments,
  previous?: AmendmentProposal,
  draft?: AmendmentPayload | null,
  source?: AmendmentProposal
) {
  if (draft && draft.baseRevisionId !== data.currentTermsRevisionId)
    return {
      error: 'Bản nháp dựa trên điều khoản cũ. Hãy bắt đầu lại và đối chiếu nội dung đang áp dụng.',
    } as const;
  const acceptedRequest = source ?? data.proposals.find((p) => p.status === 'TENANT_ACCEPTED');
  if (draft?.tenantRequestId && draft.tenantRequestId !== acceptedRequest?.id)
    return {
      error: 'Yêu cầu liên kết bản nháp đã đóng. Xóa bản nháp hoặc bắt đầu đề xuất mới.',
    } as const;
  const change: TermRow = draft?.changes ?? previous?.changes ?? {};
  const oldScheduled = scheduledSource(data.proposals, draft?.previousProposalId ?? previous?.id);
  return {
    error: undefined,
    values: restoreTerms(data.currentTerms, change),
    listingSourceVersion:
      typeof change.listingSourceVersion === 'string' ? change.listingSourceVersion : undefined,
    editingFinancial:
      'rentAmount' in change ||
      'charges' in change ||
      Boolean((change.fields as TermRow | undefined)?.financial),
    initialValues: JSON.stringify(restoreTerms(data.currentTerms, oldScheduled?.changes ?? {})),
    reason: draft?.reason ?? previous?.reason ?? source?.reason ?? '',
    effectiveOn:
      previous?.status === 'SCHEDULED'
        ? previous.effectiveOn
        : (draft?.effectiveOn ??
          (previous?.immediateEffect ? undefined : previous?.effectiveOn) ??
          data.availableDates[0] ??
          ''),
    previousId: draft?.previousProposalId ?? previous?.id,
    tenantRequestId: draft?.tenantRequestId ?? acceptedRequest?.id,
    evidenceIds: draft?.evidenceIds ?? previous?.evidenceIds ?? [],
  };
}

/** :121-141. Pass only while editing; the web returns {} otherwise. */
export function amendmentChanges(
  data: Pick<ContractAmendments, 'currentTerms'> | null,
  editing: boolean,
  values: AmendmentTerms,
  previousId?: string,
  listingSourceVersion?: string
): TermRow {
  if (!data || !editing) return {};
  const t = data.currentTerms,
    result: TermRow = {};
  if (String(values.financial.amountValue) !== String(t.financial.amountValue))
    result.rentAmount = String(values.financial.amountValue ?? '');
  for (const k of ['occupantCount', 'motorbikeCount', 'carCount'])
    if (String(values.tenant[k] ?? 0) !== String(t.tenant[k] ?? 0)) result[k] = values.tenant[k];
  if (JSON.stringify(values.charges) !== JSON.stringify(t.charges)) result.charges = values.charges;
  const fields: TermRow = {};
  for (const group of ['landlord', 'tenant', 'lease', 'financial', 'policies'] as const) {
    const excluded =
      group === 'tenant'
        ? ['occupantCount', 'motorbikeCount', 'carCount']
        : group === 'financial'
          ? ['amountValue', 'amountNumber', 'amountWords', 'paymentDueDay', 'paymentDueOffsetDays']
          : [];
    const rows = Object.fromEntries(
      Object.entries(values[group] ?? {}).filter(
        ([key, value]) =>
          !excluded.includes(key) && JSON.stringify(value) !== JSON.stringify((t[group] ?? {})[key])
      )
    );
    if (group === 'policies')
      for (const key of Object.keys(rows)) {
        if (!['latePaymentFeeMode', 'latePaymentFeeAmount'].includes(key)) delete rows[key];
      }
    if (Object.keys(rows).length) fields[group] = rows;
  }
  if (Object.keys(fields).length) result.fields = fields;
  if (listingSourceVersion) result.listingSourceVersion = listingSourceVersion;
  if (values.specialTerms !== t.specialTerms) result.specialTerms = values.specialTerms;
  if (Object.keys(result).length || previousId) result.freeForm = true;
  return result;
}

// :143-144 — `replacement` is scheduledSource(data.proposals, previousId).
export function amendmentHasChanges(
  changes: TermRow,
  replacement: AmendmentProposal | undefined,
  values: AmendmentTerms,
  initialValues: string,
  listingSourceVersion?: string
): boolean {
  return Boolean(
    Object.keys(changes).length &&
    (!replacement ||
      JSON.stringify(values) !== initialValues ||
      listingSourceVersion !== replacement.changes.listingSourceVersion)
  );
}

// :145-149
export function amendmentChangedGroupCount(
  changes: TermRow,
  replacement: AmendmentProposal | undefined,
  values: AmendmentTerms,
  initialValues: string
): number {
  if (!replacement || !initialValues)
    return Object.keys(changes).filter((key) => key !== 'freeForm').length;
  const before = JSON.parse(initialValues) as AmendmentTerms;
  return (Object.keys(values) as (keyof AmendmentTerms)[]).filter(
    (key) => JSON.stringify(values[key]) !== JSON.stringify(before[key])
  ).length;
}

// :150-153
export function amendmentFinancial(
  changes: TermRow,
  listingSync: Pick<ContractListingSyncPreview, 'differences'> | null
): boolean {
  const changedFields = changes.fields as TermRow | undefined;
  return (
    ['rentAmount', 'charges', 'occupantCount', 'motorbikeCount', 'carCount'].some(
      (k) => k in changes
    ) ||
    Boolean(
      changedFields?.financial ||
      changedFields?.lease ||
      changedFields?.policies ||
      (changedFields?.property as TermRow | undefined)?.areaText
    ) ||
    Boolean(
      listingSync?.differences.some(
        (row) =>
          /^(charges|financial|meters)(\.|$)/.test(row.field) || row.field === 'property.areaText'
      )
    )
  );
}

/**
 * :154-168 (`payload`). Throws the web's messages. The DOM `input:invalid` check (:160-161) becomes
 * `hasInvalidInput`: the form passes true when a numeric/date input holds an invalid value.
 */
export function amendmentPayload(
  form: {
    data: ContractAmendments | null;
    listingSourceVersion?: string;
    listingSync: ContractListingSyncPreview | null;
    changes: TermRow;
    hasChanges: boolean;
    reason: string;
    effectiveOn: string;
    replacement?: AmendmentProposal;
    requestId: string;
    baseRevisionId: string;
    previousId?: string;
    tenantRequestId?: string;
    evidenceIds: string[];
    hasInvalidInput?: boolean;
  },
  validate = true
): AmendmentPayload {
  const { data, changes, reason, effectiveOn, replacement } = form;
  const changedFields = changes.fields as TermRow | undefined;
  if (!data) throw new Error('Chưa có dữ liệu hợp đồng.');
  if (form.listingSourceVersion && !form.listingSync)
    throw new Error('Hãy cập nhật lại dữ liệu bài đăng trước khi lưu phụ lục.');
  if (
    form.listingSourceVersion &&
    ('rentAmount' in changes || 'charges' in changes || changedFields?.financial)
  )
    throw new Error('Hãy lập đề xuất tài chính riêng cho thay đổi giá thuê, tiền cọc hoặc phí.');
  if (validate) {
    if (form.hasInvalidInput) throw new Error('Kiểm tra lại giá trị số/ngày đang nhập.');
    if (!form.hasChanges) throw new Error('Chưa có nội dung thay đổi.');
    if (reason.trim().length < 10) throw new Error('Lý do cần ít nhất 10 ký tự.');
    if (
      !data.availableDates.includes(effectiveOn) ||
      (replacement && effectiveOn !== replacement.effectiveOn)
    )
      throw new Error('Chọn đầu kỳ áp dụng hợp lệ; bản thay thế phải giữ ngày hiệu lực cũ.');
  }
  return {
    requestId: form.requestId,
    baseRevisionId: form.baseRevisionId,
    previousProposalId: form.previousId,
    tenantRequestId: form.tenantRequestId,
    effectiveOn: effectiveOn || null,
    reason: reason.trim(),
    changes: { ...changes },
    evidenceIds: form.evidenceIds,
  };
}
