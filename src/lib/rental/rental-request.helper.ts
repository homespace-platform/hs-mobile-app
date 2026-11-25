// Port of hs-web-app components/rental-request/rental-request.helper.ts (formatVND uses ./format instead of Hermes Intl).
import { currencyVnd } from '@/lib/rental/format';
import type {
  RentalEstimateResponse,
  PredictableChargeItem,
  ExcludedChargeItem,
} from '@/types/rental/rental-request.type';

export const formatVND = (price: number): string => currencyVnd(price || 0);

export function clampValue(val: number, min: number, max: number): number {
  if (isNaN(val)) return min;
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

export function hasVehicleParkingAllowed(estimate?: RentalEstimateResponse | null): boolean {
  if (!estimate) return false;
  return Boolean(estimate.motorbike?.allowed || estimate.car?.allowed);
}

export function hasPersonBasedCharges(estimate?: RentalEstimateResponse | null): boolean {
  if (!estimate) return false;
  return estimate.predictableCharges?.some((c) => c.billingMethod === 'PER_PERSON_MONTH') ?? false;
}

export interface PartitionedPredictableCharges {
  /** Các khoản phải đóng hàng tháng (loại bỏ các khoản INCLUDED hoặc FREE) */
  payableCharges: PredictableChargeItem[];
  /** Các khoản đã bao gồm trong tiền thuê */
  includedCharges: PredictableChargeItem[];
  /** Các khoản miễn phí */
  freeCharges: PredictableChargeItem[];
}

export function partitionPredictableCharges(
  charges?: PredictableChargeItem[] | null
): PartitionedPredictableCharges {
  if (!charges || charges.length === 0) {
    return { payableCharges: [], includedCharges: [], freeCharges: [] };
  }

  const payableCharges: PredictableChargeItem[] = [];
  const includedCharges: PredictableChargeItem[] = [];
  const freeCharges: PredictableChargeItem[] = [];

  for (const c of charges) {
    if (c.billingMethod === 'FREE') {
      freeCharges.push(c);
    } else if (c.includedInRent || c.billingMethod === 'INCLUDED') {
      includedCharges.push(c);
    } else {
      payableCharges.push(c);
    }
  }

  return { payableCharges, includedCharges, freeCharges };
}

export interface PartitionedExcludedCharges {
  /** Các khoản tính sau theo sử dụng thực tế (điện, nước theo chỉ số, theo giờ) */
  meteredCharges: ExcludedChargeItem[];
  /** Các khoản cần xác nhận hoặc tự thanh toán (thỏa thuận, custom, tự túc, v.v.) */
  negotiableOrCustomCharges: ExcludedChargeItem[];
}

const METERED_BILLING_METHODS = new Set(['PER_KWH', 'PER_M3', 'STATE_WATER_RATE', 'PER_HOUR']);

export function partitionExcludedCharges(
  charges?: ExcludedChargeItem[] | null
): PartitionedExcludedCharges {
  if (!charges || charges.length === 0) {
    return { meteredCharges: [], negotiableOrCustomCharges: [] };
  }

  const meteredCharges: ExcludedChargeItem[] = [];
  const negotiableOrCustomCharges: ExcludedChargeItem[] = [];

  for (const c of charges) {
    if (c.billingMethod && METERED_BILLING_METHODS.has(c.billingMethod)) {
      meteredCharges.push(c);
    } else {
      negotiableOrCustomCharges.push(c);
    }
  }

  return { meteredCharges, negotiableOrCustomCharges };
}

export function formatExcludedChargeValue(c: ExcludedChargeItem): string {
  if (c.billingMethod === 'PER_KWH' && c.unitAmount && c.unitAmount > 0) {
    return `${formatVND(c.unitAmount)}/kWh`;
  }
  if (c.billingMethod === 'PER_M3' && c.unitAmount && c.unitAmount > 0) {
    return `${formatVND(c.unitAmount)}/m³`;
  }
  if (c.billingMethod === 'STATE_WATER_RATE') {
    return 'Theo biểu giá nhà nước';
  }
  if (c.billingMethod === 'PER_HOUR' && c.unitAmount && c.unitAmount > 0) {
    return `${formatVND(c.unitAmount)}/giờ`;
  }
  return c.reason;
}
