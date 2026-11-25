// Port of hs-web-app components/contract/detail/ContractChargesSection.tsx:14-34.
export const BILLING_METHOD_LABELS: Record<string, string> = {
  PER_MONTH: 'Tháng',
  PER_VEHICLE_MONTH: 'Xe / tháng',
  PER_KWH: 'kWh (theo công tơ)',
  PER_M3: 'm³ (theo đồng hồ)',
  PER_PERSON_MONTH: 'Người / tháng',
  PER_M2_MONTH: 'm² / tháng',
  PER_HOUR: 'Giờ',
  FREE: 'Miễn phí',
  INCLUDED: 'Đã bao gồm',
  STATE_WATER_RATE: 'Theo giá nhà nước',
  NOT_APPLICABLE: 'Không áp dụng',
  NEGOTIABLE: 'Thỏa thuận',
  CUSTOM: 'Tùy chỉnh',
};

export function formatBillingMethod(method?: unknown): string {
  if (!method) return '—';
  const s = String(method).trim();
  return BILLING_METHOD_LABELS[s.toUpperCase()] || s;
}
