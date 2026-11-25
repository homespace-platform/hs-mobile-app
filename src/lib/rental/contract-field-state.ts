// Port of hs-web-app lib/contract-field-state.ts (web text colour classes mapped to theme tokens).
import type { AmendmentTerms, TermRow } from '@/types/rental/contract-amendment.type';

export type ContractFieldState = 'editable' | 'changed' | 'readonly';
export const fieldStateText: Record<ContractFieldState, string> = {
  editable: 'Có thể điều chỉnh qua phụ lục',
  changed: 'Đã sửa trong bản phụ lục đang soạn',
  readonly: 'Chỉ đọc · Hệ thống hoặc dữ liệu lịch sử',
};
export const fieldStateClass: Record<ContractFieldState, string> = {
  editable: 'text-primary',
  changed: 'text-success',
  readonly: 'text-foreground',
};
const text = (value: unknown) => String(value ?? '').trim();
const identity = (row: TermRow) => text(row.code ?? row.featureName ?? row.name);
function equal(a: unknown, b: unknown, key: string) {
  if (key === 'unitNumber') return (text(a) || 'Toàn bộ căn') === (text(b) || 'Toàn bộ căn');
  if (key === 'areaText' || key === 'featureValue') {
    const normalized = (v: unknown) =>
      text(v)
        .replace(/m²|m2/gi, 'mét vuông')
        .replace(
          /^(\d+(?:[.,]\d+)?)(\s|$)/,
          (_, n, space) => String(Number(n.replace(',', '.'))) + space
        );
    return normalized(a) === normalized(b);
  }
  if (key === 'billingMethod') {
    const method = (value: unknown) =>
      (
        ({
          per_month: 'month',
          tháng: 'month',
          'theo tháng': 'month',
          per_person_month: 'person',
          'người / tháng': 'person',
          per_vehicle_month: 'vehicle',
          'xe / tháng': 'vehicle',
          'xe máy / tháng': 'vehicle',
          'ô tô / tháng': 'vehicle',
          per_kwh: 'kwh',
          per_m3: 'm3',
          'm³': 'm3',
          per_m2_month: 'm2',
          'm² / tháng': 'm2',
          'mét vuông / tháng': 'm2',
          included: 'included',
          'bao gồm': 'included',
          free: 'free',
          'miễn phí': 'free',
          not_applicable: 'none',
          'không áp dụng': 'none',
        }) as Record<string, string>
      )[
        text(value)
          .toLowerCase()
          .replace(/\s*\/\s*/g, ' / ')
      ] ?? text(value).toLowerCase();
    return method(a) === method(b);
  }
  if (key === 'latePaymentFeeMode') {
    const mode = (v: unknown) =>
      (
        ({ 'không phạt': 'NONE', 'một lần': 'FIXED_ONCE', 'mỗi ngày': 'FIXED_PER_DAY' }) as Record<
          string,
          string
        >
      )[text(v).toLowerCase()] ?? text(v).toUpperCase();
    return mode(a) === mode(b);
  }
  if (
    [
      'amountValue',
      'depositAmountValue',
      'unitAmount',
      'quantity',
      'occupantCount',
      'motorbikeCount',
      'carCount',
      'maxOccupants',
      'maxVehicles',
      'durationMonths',
      'latePaymentFeeAmount',
    ].includes(key)
  ) {
    if (text(a) && text(b) && Number.isFinite(Number(a)) && Number.isFinite(Number(b)))
      return Number(a) === Number(b);
  }
  // Account numbers are intentionally strings: changing a leading zero is a real edit.
  return text(a) === text(b);
}
/** Compare to the editor's source (signed scheduled terms for a replacement), not keystroke history. */
export function amendmentFieldChanged(
  base: AmendmentTerms,
  current: AmendmentTerms,
  group: keyof AmendmentTerms,
  key?: string,
  index?: number
) {
  if (index === undefined) {
    const get = (terms: AmendmentTerms) =>
      key === 'depositAmountValue'
        ? (terms.financial.depositAmountValue ??
          text(terms.financial.depositAmountNumber).replace(/\D/g, ''))
        : key
          ? (terms[group] as TermRow | undefined)?.[key]
          : terms[group];
    const a = get(base),
      b = get(current);
    return !equal(a, b, key ?? group);
  }
  const list = (terms: AmendmentTerms): TermRow[] =>
    group === 'property'
      ? ((terms.property.features as TermRow[]) ?? [])
      : group === 'policies'
        ? ((terms.policies.listingPolicies as TermRow[]) ??
          Object.entries(terms.policies)
            .filter(
              ([k, v]) =>
                [
                  'petPolicy',
                  'smokingPolicy',
                  'subleasePolicy',
                  'overnightGuestPolicy',
                  'propertyInspectionNotice',
                  'depositRefundDays',
                  'noticeDaysBeforeTermination',
                ].includes(k) && v !== undefined
            )
            .map(([code, value]) => ({ code, label: code, value, displayValue: value })))
        : ((terms[group] as TermRow[]) ?? []);
  const before = list(base),
    after = list(current),
    row = after[index];
  if (!row) return false;
  const duplicates = after.filter((r) => identity(r) === identity(row)).length > 1;
  let original = duplicates
    ? before[index]
    : before.find((r) => identity(r) && identity(r) === identity(row));
  // Renaming a row falls back to its source slot only if that source is not still used elsewhere.
  if (!original && before[index] && !after.some((r) => identity(r) === identity(before[index])))
    original = before[index];
  if (!original) return true;
  if (key === 'displayValue')
    return !equal(original.displayValue ?? original.value, row.displayValue ?? row.value, key);
  return !equal(original[key ?? ''], row[key ?? ''], key ?? '');
}
