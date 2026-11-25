// Port of the logic inside hs-web-app components/rental-request/RentalRequestModal.tsx (line numbers refer
// to that file). The component state is passed in; the messages and the check order are the web's.
import { format, isBefore, startOfDay } from 'date-fns';
import type {
  CreateRentalRequestPayload,
  RentalEstimatePayload,
  RentalEstimateResponse,
} from '@/types/rental/rental-request.type';

// :139-155 — four quick lease choices, adapted to the listing minimum.
export function quickLeaseOptions(minimumLeaseMonths: number | null | undefined): number[] {
  const min = Math.max(Number(minimumLeaseMonths) || 1, 1);
  if (min <= 6) return [6, 12, 18, 24];
  if (min <= 12) return [12, 24, 36, 48];
  if (min <= 24) {
    const opts = [min, 24, 36, 48].filter((v, i, a) => a.indexOf(v) === i);
    while (opts.length < 4) opts.push(opts[opts.length - 1] + 12);
    return opts.slice(0, 4);
  }
  return [min, min + 6, min + 12, min + 24];
}

// :180-181 — lease length selected when the form opens.
export function defaultLeaseMonths(minimumLeaseMonths: number | null | undefined): number {
  const min = Math.max(Number(minimumLeaseMonths) || 1, 1);
  return min > 12 ? min : 12;
}

// :157-164
export const formatLeaseLabel = (months: number) => {
  if (months < 12) return `${months} tháng`;
  const years = months / 12;
  if (Number.isInteger(years)) return `${months} th (${years} năm)`;
  return `${months} tháng`;
};

// :166-173
export const formatDetailedDuration = (months: number) => {
  if (!months || months <= 0) return '0 tháng';
  if (months < 12) return `${months} tháng`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (m === 0) return `${y} năm (${months} tháng)`;
  return `${y} năm ${m} tháng (${months} tháng)`;
};

// :208-276 — deposit shown before the backend estimate arrives.
export function depositInfo(input: {
  listingPrice?: number;
  depositType?: string | null;
  listingDepositAmount?: number | null;
  depositMonths?: number | null;
  customDepositInput: string;
}) {
  const { depositType, listingDepositAmount, depositMonths, customDepositInput } = input;
  const rent = input.listingPrice || 0;
  let type = (depositType ?? undefined) as string | undefined;
  if (!type) {
    if (listingDepositAmount != null && listingDepositAmount > 0) type = 'FIXED_AMOUNT';
    else if (depositMonths != null && depositMonths > 0) type = 'MONTH_COUNT';
    else type = 'FIXED_AMOUNT';
  }

  if (type === 'NONE') {
    return {
      type: 'NONE' as const,
      label: 'Không đặt cọc',
      badge: 'Không yêu cầu đặt cọc',
      amount: 0,
      isNegotiable: false,
    };
  }
  if (type === 'MONTH_COUNT') {
    const months = depositMonths && depositMonths > 0 ? depositMonths : 1;
    return {
      type: 'MONTH_COUNT' as const,
      label: `Cọc ${months} tháng tiền nhà`,
      badge: `${months} tháng tiền nhà`,
      amount: rent * months,
      isNegotiable: false,
    };
  }
  if (type === 'FIXED_AMOUNT') {
    return {
      type: 'FIXED_AMOUNT' as const,
      label: 'Cọc theo số tiền',
      badge: 'Cố định theo bài đăng',
      amount: listingDepositAmount != null ? listingDepositAmount : rent,
      isNegotiable: false,
    };
  }

  // type === "NEGOTIABLE"
  let negotiatedAmt: number;
  if (customDepositInput === '') {
    negotiatedAmt = rent;
  } else {
    const parsed = Number(customDepositInput.replace(/\D/g, ''));
    negotiatedAmt = isNaN(parsed) ? 0 : parsed;
  }
  return {
    type: 'NEGOTIABLE' as const,
    label: 'Tiền cọc thỏa thuận',
    badge: 'Theo thỏa thuận',
    amount: negotiatedAmt,
    isNegotiable: true,
  };
}

export interface EstimateInput {
  listingId: string;
  moveInDate: Date;
  leaseMonths: number;
  occupantCount: number;
  motorbikeCount: number;
  carCount: number;
  deposit: { isNegotiable: boolean; amount: number };
}

// :279-280 — an estimate (or its error) is only shown while its key matches the form.
export const estimateKey = (i: EstimateInput) =>
  JSON.stringify([
    i.listingId,
    format(i.moveInDate, 'yyyy-MM-dd'),
    i.leaseMonths,
    i.occupantCount,
    i.motorbikeCount,
    i.carCount,
    i.deposit.isNegotiable,
    i.deposit.amount,
  ]);

// :293-304 — body of the debounced (250 ms) estimate call.
export const estimateRequest = (i: EstimateInput): RentalEstimatePayload => ({
  listingId: i.listingId,
  moveInDate: format(i.moveInDate, 'yyyy-MM-dd'),
  leaseMonths: i.leaseMonths,
  occupantCount: Math.max(1, i.occupantCount || 1),
  motorbikeCount: Math.min(Math.max(0, i.motorbikeCount || 0), Math.max(1, i.occupantCount || 1)),
  carCount: Math.min(Math.max(0, i.carCount || 0), Math.max(1, i.occupantCount || 1)),
  negotiatedDepositAmount: i.deposit.isNegotiable ? i.deposit.amount : undefined,
});

export const ESTIMATE_ERROR_FALLBACK = 'Không thể tính toán chi phí dự kiến cho bài đăng này.';

// :313-338 — counts after a fresh estimate (vehicle slots and occupant capacity).
export function clampAfterEstimate(
  res: Pick<RentalEstimateResponse, 'motorbike' | 'car' | 'occupantLimit'>,
  counts: { occupantCount: number; motorbikeCount: number; carCount: number }
) {
  let { occupantCount, motorbikeCount, carCount } = counts;
  const effectiveOcc = Math.max(1, counts.occupantCount || 1);
  if (!res.motorbike.allowed && counts.motorbikeCount > 0) {
    motorbikeCount = 0;
  } else if (res.motorbike.allowed) {
    const maxMoto = Math.min(res.motorbike.available, effectiveOcc);
    if (counts.motorbikeCount > maxMoto) motorbikeCount = maxMoto;
  }
  if (!res.car.allowed && counts.carCount > 0) {
    carCount = 0;
  } else if (res.car.allowed) {
    const maxCar = Math.min(res.car.available, effectiveOcc);
    if (counts.carCount > maxCar) carCount = maxCar;
  }
  if (res.occupantLimit && counts.occupantCount > res.occupantLimit) {
    const limit = res.occupantLimit;
    occupantCount = limit;
    motorbikeCount = Math.min(motorbikeCount, limit);
    carCount = Math.min(carCount, limit);
  }
  return { occupantCount, motorbikeCount, carCount };
}

// :385-451 — first failing check wins; null means the request may be sent.
export function validateRentalRequest(
  form: {
    reservationPolicyAccepted: boolean;
    reservationPolicy: { version: string } | null;
    moveInDate: Date | null | undefined;
    loadingEstimate: boolean;
    estimateError: string | null;
    estimate: RentalEstimateResponse | null;
    leaseMonths: number;
    minimumLeaseMonths?: number;
    occupantCount: number;
    occupantLimit: number | null;
    motorbikeCount: number;
    carCount: number;
    renterName: string;
    renterPhone: string;
  },
  now = new Date()
): string | null {
  const { estimate, moveInDate, leaseMonths, occupantCount, occupantLimit } = form;
  // The web component defaults this prop to 6 (:79).
  const minimumLeaseMonths = form.minimumLeaseMonths === undefined ? 6 : form.minimumLeaseMonths;
  if (!form.reservationPolicyAccepted || !form.reservationPolicy)
    return 'Bạn cần đồng ý điều kiện giữ chỗ trước khi gửi yêu cầu thuê.';
  if (!moveInDate) return 'Vui lòng chọn ngày bắt đầu dọn vào';
  if (form.loadingEstimate || form.estimateError || !estimate?.paymentPlan)
    return 'Vui lòng chờ hệ thống xác định lịch và khoản thanh toán trước khi gửi yêu cầu.';
  if (isBefore(startOfDay(moveInDate), startOfDay(now)))
    return 'Ngày bắt đầu thuê không thể trong quá khứ';
  if (!leaseMonths || leaseMonths < 1) return 'Vui lòng chọn thời hạn thuê hợp lệ';
  if (minimumLeaseMonths && leaseMonths < minimumLeaseMonths)
    return `Thời hạn thuê tối thiểu cho căn này là ${minimumLeaseMonths} tháng`;
  if (!Number.isSafeInteger(occupantCount) || occupantCount < 1)
    return 'Vui lòng nhập số người dọn vào ở (tối thiểu 1 người)';
  if (occupantLimit && occupantCount > occupantLimit)
    return `Bài đăng chỉ cho phép tối đa ${occupantLimit} người.`;
  if (estimate.motorbike.allowed && form.motorbikeCount > estimate.motorbike.available)
    return `Chỉ còn ${estimate.motorbike.available} chỗ xe máy khả dụng trong thời gian này.`;
  if (estimate.car.allowed && form.carCount > estimate.car.available)
    return `Chỉ còn ${estimate.car.available} chỗ ô tô khả dụng trong thời gian này.`;
  if (!form.renterName.trim()) return 'Vui lòng nhập họ và tên của bạn';
  if (!form.renterPhone.trim()) return 'Vui lòng nhập số điện thoại liên hệ';
  return null;
}

// :372 and :455-470 — body of POST rental-requests. Call only after validateRentalRequest returned null.
export function createRentalRequestBody(form: {
  listingId: string;
  moveInDate: Date;
  leaseMonths: number;
  occupantCount: number;
  motorbikeCount: number;
  carCount: number;
  renterName: string;
  renterPhone: string;
  renterEmail: string;
  renterNote: string;
  estimate: Pick<RentalEstimateResponse, 'depositAmount'> | null;
  deposit: { isNegotiable: boolean; amount: number };
  reservationPolicyAccepted: boolean;
  reservationPolicyVersion: string;
}): CreateRentalRequestPayload {
  const depositAmount = form.estimate?.depositAmount ?? form.deposit.amount;
  return {
    listingId: form.listingId,
    moveInDate: format(form.moveInDate, 'yyyy-MM-dd'),
    leaseMonths: form.leaseMonths,
    occupantCount: form.occupantCount,
    motorbikeCount: Math.min(form.motorbikeCount, form.occupantCount),
    carCount: Math.min(form.carCount, form.occupantCount),
    renterName: form.renterName.trim(),
    renterPhone: form.renterPhone.trim(),
    renterEmail: form.renterEmail.trim() || undefined,
    depositAmount,
    negotiatedDepositAmount: form.deposit.isNegotiable ? depositAmount : undefined,
    renterNote: form.renterNote.trim() || undefined,
    reservationPolicyAccepted: form.reservationPolicyAccepted,
    reservationPolicyVersion: form.reservationPolicyVersion,
  };
}
