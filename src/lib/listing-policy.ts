// Port of hs-web-app lib/listing-policy-suggestions.ts, types/listing-policy.type.ts and the
// field rules of components/listing/ListingPolicyFields.tsx.
import data from '@/data/listing-policy-suggestions.json';

export type ListingPolicyInput = { code: string; value: string; note?: string };
export type ListingPolicyDefinition = {
  code: string;
  label: string;
  valueType: 'PERMISSION' | 'INTEGER' | 'TEXT';
  helpText?: string;
  unitLabel?: string;
  required: boolean;
  minimumValue?: number | null;
  maximumValue?: number | null;
  sortOrder?: number;
  choices?: { value: string; label: string }[];
};

export const policyPermissions = [
  { value: 'ALLOWED', label: 'Cho phép' },
  { value: 'NOT_ALLOWED', label: 'Không cho phép' },
  { value: 'APPROVAL_REQUIRED', label: 'Cần chủ nhà chấp thuận trước' },
];
export const POLICY_TEXT_MAX = 2000;
export const POLICY_NOTE_MAX = 1000;

export function policyInputs(
  rows: ListingPolicyInput[],
  definitions: ListingPolicyDefinition[]
): ListingPolicyInput[] {
  return rows
    .filter((row) => row.value.trim() && definitions.some((d) => d.code === row.code))
    .map((row) => ({ code: row.code, value: row.value.trim(), note: row.note?.trim() || '' }));
}

// category -> policy code -> key (a PERMISSION choice, "note" for INTEGER, "value" for TEXT)
const catalog = data as unknown as Record<string, Record<string, Record<string, string>>>;

export function policySuggestion(category: string, code: string, key: string): string | undefined {
  return catalog[category]?.[code]?.[key];
}

function isSuggestion(code: string, text: string) {
  return Object.values(catalog).some((codes) => Object.values(codes[code] ?? {}).includes(text));
}

/** True when overwriting cannot lose user-written text. */
export function canReplacePolicyText(code: string, text = '') {
  return !text.trim() || isSuggestion(code, text);
}

export function selectPermission(
  row: ListingPolicyInput,
  value: string,
  category: string
): ListingPolicyInput {
  const note = canReplacePolicyText(row.code, row.note)
    ? (policySuggestion(category, row.code, value) ?? '')
    : row.note;
  return { ...row, value, note };
}

/** Fixed by the platform, same as the core-api fallbacks. Landlords cannot change them. */
export const systemPolicyValues: Record<string, string> = {
  propertyInspectionNotice: '24',
  noticeDaysBeforeTermination: '30',
  depositRefundDays: '15',
};

/** What the form shows and submits: system rules override anything typed or previously saved. */
export function withSystemRules(
  rows: ListingPolicyInput[],
  definitions: ListingPolicyDefinition[],
  category: string
): ListingPolicyInput[] {
  const fixed = definitions
    .filter((d) => d.code in systemPolicyValues)
    .map((d) => ({
      code: d.code,
      value: systemPolicyValues[d.code],
      note: policySuggestion(category, d.code, 'note') ?? '',
    }));
  return fixed.length
    ? [...rows.filter((r) => !fixed.some((f) => f.code === r.code)), ...fixed]
    : rows;
}

/** New listings only: unanswered permissions start as ALLOWED and text rules are prefilled. */
export function withDefaultSuggestions(
  rows: ListingPolicyInput[],
  definitions: ListingPolicyDefinition[],
  category: string
): ListingPolicyInput[] {
  const added = definitions
    .filter((d) => !rows.some((r) => r.code === d.code))
    .flatMap((d) => {
      const blank = { code: d.code, value: '', note: '' };
      if (d.valueType === 'PERMISSION')
        return !d.choices?.length || d.choices.some((c) => c.value === 'ALLOWED')
          ? [selectPermission(blank, 'ALLOWED', category)]
          : [];
      const value =
        d.valueType === 'TEXT' ? policySuggestion(category, d.code, 'value') : undefined;
      return value ? [{ ...blank, value }] : [];
    });
  return added.length ? [...rows, ...added] : rows;
}

/** For a user-initiated category change only; never run it on loaded listing data. */
export function swapPolicySuggestions(
  rows: ListingPolicyInput[],
  category: string
): ListingPolicyInput[] {
  return rows.map((row) => {
    const value = policySuggestion(category, row.code, 'value');
    if (value) return isSuggestion(row.code, row.value) ? { ...row, value } : row;
    const note =
      policySuggestion(category, row.code, 'note') ??
      policySuggestion(category, row.code, row.value);
    return note && row.note && isSuggestion(row.code, row.note) ? { ...row, note } : row;
  });
}

export const policyRow = (rows: ListingPolicyInput[], code: string): ListingPolicyInput =>
  rows.find((row) => row.code === code) ?? { code, value: '', note: '' };

/** Next `listingPolicies` after editing one row. */
export const replacePolicy = (rows: ListingPolicyInput[], row: ListingPolicyInput) => [
  ...rows.filter((item) => item.code !== row.code),
  row,
];

/** Render rules of one policy card. `template` is set only when "Dùng mẫu gợi ý" may be offered. */
export function policyField(
  definition: ListingPolicyDefinition,
  rows: ListingPolicyInput[],
  category: string
) {
  const row = policyRow(rows, definition.code);
  const fixedValue: string | undefined = systemPolicyValues[definition.code];
  const target: 'value' | 'note' = definition.valueType === 'TEXT' ? 'value' : 'note';
  const suggestion =
    definition.valueType === 'PERMISSION'
      ? undefined
      : policySuggestion(category, definition.code, target);
  const offer =
    fixedValue === undefined &&
    suggestion !== undefined &&
    row[target] !== suggestion &&
    canReplacePolicyText(definition.code, row[target]);
  return {
    row,
    /** Read-only "Quy định hệ thống" card. */
    fixedValue,
    fixedNote:
      fixedValue === undefined ? undefined : policySuggestion(category, definition.code, 'note'),
    choices: definition.choices?.length ? definition.choices : policyPermissions,
    template: offer ? { target, text: suggestion! } : undefined,
  };
}

export const CATALOG_LOADING = 'Đang tải chính sách theo loại hình…';
export const CATALOG_LOAD_FAILED =
  'Không tải được chính sách theo loại hình. Vui lòng tải lại trang trước khi gửi duyệt.';
/** `policyCatalogError` after a successful catalog request ('' = usable). */
export const catalogMessage = (policies: ListingPolicyDefinition[] | undefined) =>
  policies?.length
    ? ''
    : 'Danh mục chính sách chưa có dữ liệu. Vui lòng khởi động backend và tải lại.';
