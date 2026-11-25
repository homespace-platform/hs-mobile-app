// Rules the web keeps inside the addendum .tsx components (InlineAmendmentFields = IAF,
// ContractAmendmentPanel = AP, in hs-web-app components/contract/detail/). Pure, and run against the web
// source by tests/rental-contract-amendment.test.cjs.
//
// KEY ORDER MATTERS: change detection compares JSON.stringify output. Keep every spread in the web's order.
import {
  amendmentDateText,
  amendmentLeasePatch,
  amendmentNumbers,
} from '@/lib/rental/contract-amendment-input';
import { activeAmendment } from '@/lib/rental/ContractAmendmentWorkspace';
import type {
  AmendmentPayload,
  AmendmentProposal,
  AmendmentTerms,
  TermRow,
} from '@/types/rental/contract-amendment.type';

const text = (v: unknown) => String(v ?? '');

// IAF:17-21
export const methodLabels: Record<string, string> = {
  PER_MONTH: 'Tháng',
  PER_PERSON_MONTH: 'Người / tháng',
  PER_VEHICLE_MONTH: 'Xe / tháng',
  PER_KWH: 'kWh',
  PER_M3: 'm³',
  PER_M2_MONTH: 'mét vuông / tháng',
  FREE: 'Miễn phí',
  INCLUDED: 'Bao gồm',
  NOT_APPLICABLE: 'Không áp dụng',
};
export const feeLabels: Record<string, string> = {
  NONE: 'Không phạt',
  FIXED_ONCE: 'Một lần',
  FIXED_PER_DAY: 'Mỗi ngày',
};
const capacityKey = (name: unknown) =>
  ['Số người tối đa', 'Số người ở tối đa'].includes(text(name))
    ? 'maxOccupants'
    : ['Số xe tối đa', 'Số phương tiện tối đa'].includes(text(name))
      ? 'maxVehicles'
      : null;
const feeModeAliases: Record<string, string> = {
  'không phạt': 'NONE',
  'một lần': 'FIXED_ONCE',
  'mỗi ngày': 'FIXED_PER_DAY',
};
export const canonicalFeeMode = (v: unknown) =>
  feeModeAliases[text(v).trim().toLowerCase()] ?? text(v).trim().toUpperCase();

/** IAF:80-85. The new value of a term group after one input changed. */
export function termFieldPatch(
  group: string,
  values: TermRow,
  key: string,
  typed: string
): TermRow {
  const area = group === 'property' && key === 'areaText';
  const features: TermRow =
    group === 'property' &&
    ['maxOccupants', 'maxVehicles'].includes(key) &&
    Array.isArray(values.features)
      ? {
          features: (values.features as TermRow[]).map((row) =>
            capacityKey(row.featureName) === key
              ? { ...row, featureValue: typed + (key === 'maxOccupants' ? ' người' : ' xe') }
              : row
          ),
        }
      : {};
  const entered = key.endsWith('DateText')
    ? amendmentDateText(typed)
    : area
      ? typed
        ? typed + ' mét vuông'
        : ''
      : typed;
  return {
    ...values,
    ...(group === 'lease' ? amendmentLeasePatch(values, key, entered) : { [key]: entered }),
    ...features,
  };
}

export type TableGroup = 'charges' | 'equipments' | 'amenities';

// IAF:127
export const tableColumns: Record<TableGroup, readonly (readonly [string, string])[]> = {
  charges: [
    ['name', 'Khoản phí'],
    ['unitAmount', 'Đơn giá (đ)'],
    ['billingMethod', 'Cách tính'],
    ['note', 'Ghi chú'],
  ],
  equipments: [
    ['name', 'Tên tài sản'],
    ['quantity', 'Số lượng'],
    ['condition', 'Hiện trạng'],
    ['note', 'Ghi chú'],
  ],
  amenities: [['name', 'Tiện ích']],
};

/** IAF:130, the text of one table input. */
export function tableCellText(row: TermRow, key: string): string {
  if (key !== 'billingMethod') return text(row[key]);
  if (row.includedInRent) return 'Bao gồm';
  if (text(row[key]) === 'PER_VEHICLE_MONTH')
    return row.chargeType === 'CAR_PARKING' ? 'Ô tô / tháng' : 'Xe máy / tháng';
  return methodLabels[text(row[key])] ?? text(row[key]);
}

/** IAF:96,130. Editing a price or a billing method also clears "included in rent". */
export function tableCellRows(
  rows: TermRow[],
  index: number,
  key: string,
  value: unknown
): TermRow[] {
  const priced = key === 'unitAmount' || key === 'billingMethod';
  return rows.map((row, i) =>
    i === index
      ? priced
        ? { ...row, [key]: value, includedInRent: false }
        : { ...row, [key]: value }
      : row
  );
}

// IAF:131
export function newTableRow(group: TableGroup, uuid: () => string): TermRow {
  return group === 'charges'
    ? {
        name: '',
        chargeType: 'OTHER',
        billingMethod: 'PER_MONTH',
        unitAmount: '0',
        includedInRent: false,
        note: '',
      }
    : group === 'equipments'
      ? { name: '', quantity: 1, condition: '', note: '' }
      : { code: 'CUSTOM_' + uuid(), name: '', sourceType: 'AGREED_AMENDMENT' };
}

/** IAF:97-102, "Khôi phục mục này". */
export function resetSection(
  group: TableGroup | 'rent' | 'residents' | 'rules',
  base: AmendmentTerms,
  patch: (key: keyof AmendmentTerms, value: TermRow | TermRow[] | string) => void
) {
  if (group === 'rent') patch('financial', structuredClone(base.financial));
  else if (group === 'residents') patch('tenant', structuredClone(base.tenant));
  else if (group === 'rules') {
    patch('policies', structuredClone(base.policies));
    patch('specialTerms', base.specialTerms);
  } else patch(group, structuredClone(base[group]));
}

// IAF:116
export const feeModePatch = (policies: TermRow, mode: string): TermRow => ({
  ...policies,
  latePaymentFeeMode: mode,
  ...(mode === 'NONE' ? { latePaymentFeeAmount: '0' } : {}),
});

/** A number input's `:invalid`: empty is allowed, otherwise a whole number inside the web's bounds. */
export function amendmentNumberError(key: string, value: unknown): string | undefined {
  const rule = amendmentNumbers[key];
  const raw = text(value);
  if (!rule || raw === '') return;
  const n = Number(raw);
  if (raw.trim() === raw && Number.isInteger(n) && n >= rule.min && n <= rule.max) return;
  return `Nhập số nguyên từ ${rule.min} đến ${rule.max}.`;
}

/**
 * AW:160-161 queries the DOM. The number inputs an addendum draws are the three resident counts and
 * the lease months; returns the section holding the first invalid one.
 */
export function invalidAmendmentField(values: AmendmentTerms) {
  if (
    ['occupantCount', 'motorbikeCount', 'carCount'].some((key) =>
      amendmentNumberError(key, values.tenant[key])
    )
  )
    return 'amendment-residents';
  if (amendmentNumberError('durationMonths', values.lease?.durationMonths))
    return 'amendment-lease';
  return null;
}

// AP:60-61,68
export function panelLists(proposals: AmendmentProposal[], agreementId?: string) {
  return {
    current: proposals.find((p) => activeAmendment.has(p.status)),
    shown: agreementId
      ? proposals.filter((p) => p.agreementContractId === agreementId)
      : proposals.filter((p) => activeAmendment.has(p.status)),
    history: proposals.filter((p) => !activeAmendment.has(p.status)),
  };
}

/** AP:62-66: some ancestor of this proposal was signed by both sides. */
export function replacesSigned(proposals: AmendmentProposal[], id?: string): boolean {
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const p = proposals.find((p) => p.id === id);
    if (!p) return false;
    if (p.signedAt) return true;
    id = p.previousProposalId;
  }
  return false;
}

// AP:121
export const canResumeDraft = (draft: AmendmentPayload, current?: AmendmentProposal) =>
  !current ||
  current.status === 'TENANT_ACCEPTED' ||
  current.status === 'CHANGES_REQUESTED' ||
  (current.status === 'SCHEDULED' && draft.previousProposalId === current.id);

// AP:112
export function signingTurn(agreementStatus: string | undefined, isOwner: boolean) {
  const tenantTurn = agreementStatus === 'TENANT_SIGNATURE_PENDING';
  return {
    message: tenantTurn
      ? isOwner
        ? 'Bạn đã ký. Chờ người thuê ký để hoàn tất.'
        : 'Chủ nhà đã ký. Đến lượt bạn xem PDF và ký.'
      : isOwner
        ? 'Người thuê đã đồng ý. Đến lượt bạn ký phụ lục.'
        : 'Bạn đã đồng ý nội dung. Chờ chủ nhà ký trước.',
    link: isOwner || tenantTurn ? 'Mở phụ lục để xem và ký số' : 'Xem hồ sơ phụ lục',
  };
}

/** AP:70-73. A file already uploaded keeps its id, so a retry uploads nothing twice. */
export async function collectEvidence<F>(
  files: F[],
  old: string[],
  uploaded: Map<F, string>,
  upload: (file: F) => Promise<string>
): Promise<string[]> {
  const ids = [...old];
  if (old.length + files.length > 5) throw new Error('Tối đa 5 minh chứng.');
  for (const file of files) {
    let id = uploaded.get(file);
    if (!id) {
      id = await upload(file);
      uploaded.set(file, id);
    }
    ids.push(id);
  }
  return ids;
}

/** Everything of a proposal that the viewer reads before answering it. */
const proposalFingerprint = (p: AmendmentProposal) =>
  JSON.stringify([
    p.id,
    p.status,
    p.recipientId,
    p.previousProposalId,
    p.effectiveOn,
    p.immediateEffect,
    p.reason,
    p.comparison,
    p.evidenceIds,
  ]);

/**
 * The decision buttons of the proposal dialog (AP:141). Web offers them from the snapshot opened;
 * the phone also requires that the loaded list still holds that exact proposal.
 */
export function canAnswerProposal(
  view: AmendmentProposal | null,
  proposals: AmendmentProposal[],
  actorId: string
): boolean {
  if (!view || view.status !== 'REQUESTED' || view.recipientId !== actorId) return false;
  const live = proposals.find((p) => p.id === view.id);
  return Boolean(live) && proposalFingerprint(live!) === proposalFingerprint(view);
}
