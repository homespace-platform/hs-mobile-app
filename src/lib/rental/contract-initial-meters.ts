// Port of hs-web-app lib/contract-initial-meters.ts (verbatim; only import paths changed).
export type InitialMeterField = 'electricity' | 'water';

export function validateInitialMeterReading(
  value: string,
  required: boolean,
  label: string
): string | undefined {
  const reading = value.trim();
  if (!reading) return required ? `Vui lòng nhập ${label}.` : undefined;
  if (
    reading.length > 20 ||
    !/^\d+(\.\d{1,3}0*)?$/.test(reading) ||
    Number(reading) > 1_000_000_000_000
  )
    return `${label} phải là số không âm, tối đa 3 chữ số thập phân (ví dụ: 0 hoặc 1250.5).`;
  return undefined;
}

export function missingRequiredInitialMeters(
  meters: Record<string, unknown> | null | undefined,
  electricityRequired: boolean,
  waterRequired: boolean
): InitialMeterField[] {
  const missing: InitialMeterField[] = [];
  if (
    electricityRequired &&
    validateInitialMeterReading(String(meters?.electricityInitial ?? ''), true, 'Chỉ số điện')
  )
    missing.push('electricity');
  if (
    waterRequired &&
    validateInitialMeterReading(String(meters?.waterInitial ?? ''), true, 'Chỉ số nước')
  )
    missing.push('water');
  return missing;
}
