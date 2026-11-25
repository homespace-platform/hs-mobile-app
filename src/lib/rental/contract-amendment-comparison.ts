// Port of hs-web-app lib/contract-amendment-comparison.ts (verbatim; only import paths changed).
const billingMethodLabels: Record<string, string> = {
  PER_MONTH: 'Tháng',
  PER_PERSON_MONTH: 'Người / tháng',
  PER_VEHICLE_MONTH: 'Xe / tháng',
  PER_KWH: 'kWh (theo công tơ)',
  PER_M3: 'm³ (theo đồng hồ)',
  PER_M2_MONTH: 'm² / tháng',
  PER_HOUR: 'Giờ',
  FREE: 'Miễn phí',
  INCLUDED: 'Đã bao gồm',
  STATE_WATER_RATE: 'Theo giá nhà nước',
  NOT_APPLICABLE: 'Không áp dụng',
  NEGOTIABLE: 'Thỏa thuận',
  CUSTOM: 'Tùy chỉnh',
};

/** Older charge snapshots may have a billing method code but no display text. */
export function formatAmendmentComparisonText(field: string, value: string): string {
  if (!field.startsWith('charges.')) return value;
  return value.replace(
    /(^Cách tính:\s*)([A-Z][A-Z0-9_]+)(?=\s*$)/gm,
    (_match, prefix: string, method: string) =>
      prefix + (billingMethodLabels[method] ?? 'Chưa xác định')
  );
}
