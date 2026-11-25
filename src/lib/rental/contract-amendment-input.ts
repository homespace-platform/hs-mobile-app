// Port of hs-web-app lib/contract-amendment-input.ts (verbatim; only import paths changed).
/** Document input types. Account IDs and ledger records are not form fields. */
export const amendmentNumbers: Record<string, { min: number; max: number; step: number }> = {
  occupantCount: { min: 1, max: 100, step: 1 },
  motorbikeCount: { min: 0, max: 100, step: 1 },
  carCount: { min: 0, max: 100, step: 1 },
  maxOccupants: { min: 0, max: 100, step: 1 },
  maxVehicles: { min: 0, max: 100, step: 1 },
  durationMonths: { min: 1, max: 120, step: 1 },
};
export const squareMetresText = (value: unknown) => String(value ?? '').replace(/m²/g, 'mét vuông');
export function amendmentDateInput(value: unknown): string {
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}
export const amendmentDateText = (value: string) =>
  value ? value.split('-').reverse().join('/') : '';
export function amendmentLeasePatch(values: Record<string, unknown>, key: string, value: string) {
  const next: Record<string, unknown> = { [key]: value };
  const start = amendmentDateInput(key === 'startDateText' ? value : values.startDateText);
  if (!start) return next;
  const [year, month, day] = start.split('-').map(Number);
  if (key === 'durationMonths' || key === 'startDateText') {
    const count = Number(key === 'durationMonths' ? value : values.durationMonths);
    if (!Number.isInteger(count) || count < 1 || count > 120) return next;
    const lastDay = new Date(Date.UTC(year, month + count, 0)).getUTCDate();
    const end = new Date(Date.UTC(year, month - 1 + count, Math.min(day, lastDay)));
    end.setUTCDate(end.getUTCDate() - 1);
    next.endDateText = amendmentDateText(end.toISOString().slice(0, 10));
    next.durationText = count + ' tháng';
  } else if (key === 'endDateText') {
    const end = amendmentDateInput(value);
    if (!end) return next;
    const exclusive = new Date(end + 'T00:00:00Z');
    exclusive.setUTCDate(exclusive.getUTCDate() + 1);
    const count = (exclusive.getUTCFullYear() - year) * 12 + exclusive.getUTCMonth() - (month - 1);
    if (count > 0 && count <= 120) {
      next.durationMonths = String(count);
      next.durationText = count + ' tháng';
    }
  }
  return next;
}
const featureUnits: Record<string, string> = {
  'Diện tích đất': 'mét vuông',
  'Diện tích sử dụng': 'mét vuông',
  'Diện tích phòng': 'mét vuông',
  'Mặt tiền': 'm',
  'Chiều dài': 'm',
  'Độ rộng đường vào': 'm',
  'Độ rộng đường/hẻm': 'm',
  'Số mặt tiền': 'mặt tiền',
  'Tổng số tầng': 'tầng',
  'Số người tối đa': 'người',
  'Số người ở tối đa': 'người',
  'Số xe tối đa': 'xe',
  'Số phương tiện tối đa': 'xe',
  'Số phòng ngủ': 'phòng',
  'Số phòng tắm / WC': 'phòng',
  'Phòng khách': 'phòng',
  'Phòng bếp': 'phòng',
};
export function numericPropertyFeature(name: unknown, value: unknown) {
  const unit = featureUnits[String(name ?? '')];
  if (!unit) return null;
  const raw = squareMetresText(value).trim();
  const match = raw.match(/^(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
  return {
    value: match ? match[1].replace(',', '.') : raw,
    unit,
    step: ['m', 'mét vuông'].includes(unit) ? 'any' : 1,
    min: 0,
  };
}
