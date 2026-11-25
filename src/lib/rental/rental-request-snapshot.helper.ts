// Port of hs-web-app components/rental-request/rental-request-snapshot.helper.ts (verbatim; only import paths changed).
import { addMonths, parseISO, isValid, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { PredictableChargeItem, ExcludedChargeItem } from '@/types/rental/rental-request.type';

/**
 * Parse an toàn chuỗi JSON `costBreakdownSnapshot`
 * Trả về danh sách PredictableChargeItem đã được chuẩn hóa, hoặc [] nếu null / lỗi JSON
 */
export function parseCostBreakdownSnapshot(jsonStr?: string | null): PredictableChargeItem[] {
  if (!jsonStr || typeof jsonStr !== 'string' || !jsonStr.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
      .map((item) => ({
        chargeType: typeof item.chargeType === 'string' ? item.chargeType : 'OTHER',
        displayName: typeof item.displayName === 'string' ? item.displayName : 'Khoản phí',
        billingMethod: typeof item.billingMethod === 'string' ? item.billingMethod : 'PER_MONTH',
        unitAmount: typeof item.unitAmount === 'number' ? item.unitAmount : 0,
        quantity: typeof item.quantity === 'number' ? item.quantity : 1,
        amount: typeof item.amount === 'number' ? item.amount : 0,
        includedInRent: Boolean(item.includedInRent),
        note: typeof item.note === 'string' ? item.note : '',
      }));
  } catch {
    return [];
  }
}

/**
 * Parse an toàn chuỗi JSON `excludedChargesSnapshot`
 * Trả về danh sách ExcludedChargeItem đã được chuẩn hóa, hoặc [] nếu null / lỗi JSON
 */
export function parseExcludedChargesSnapshot(jsonStr?: string | null): ExcludedChargeItem[] {
  if (!jsonStr || typeof jsonStr !== 'string' || !jsonStr.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
      .map((item) => ({
        chargeType: typeof item.chargeType === 'string' ? item.chargeType : 'OTHER',
        displayName: typeof item.displayName === 'string' ? item.displayName : 'Khoản phí',
        billingMethod: typeof item.billingMethod === 'string' ? item.billingMethod : 'CUSTOM',
        unitAmount: typeof item.unitAmount === 'number' ? item.unitAmount : null,
        reason: typeof item.reason === 'string' ? item.reason : 'Chưa bao gồm trong tổng',
      }));
  } catch {
    return [];
  }
}

/**
 * Định dạng số người ở
 * Normalize null/undefined thành 1
 */
export function formatOccupantCount(count?: number | null): string {
  const normalized = count != null && count > 0 ? count : 1;
  return `${normalized} người`;
}

/**
 * Định dạng hiển thị xe máy / ô tô
 * Không dùng "Miễn phí" khi số lượng xe bằng 0
 * Normalize null/undefined thành 0
 */
export function formatMotorbikeCount(count?: number | null): string {
  const normalized = count != null && count > 0 ? count : 0;
  if (normalized === 0) {
    return 'Không đăng ký xe máy';
  }
  return `${normalized} xe máy`;
}

export function formatCarCount(count?: number | null): string {
  const normalized = count != null && count > 0 ? count : 0;
  if (normalized === 0) {
    return 'Không đăng ký ô tô';
  }
  return `${normalized} ô tô`;
}

/**
 * Tính ngày dự kiến kết thúc theo moveInDate + leaseMonths dùng date-fns
 * Fallback an toàn nếu chuỗi ngày không hợp lệ
 */
export function calculateEstimatedEndDate(
  moveInDateStr?: string | null,
  leaseMonths?: number | null
): string | null {
  if (!moveInDateStr) return null;
  const months = leaseMonths && leaseMonths > 0 ? leaseMonths : 1;

  try {
    const startDate = parseISO(moveInDateStr);
    if (!isValid(startDate)) return null;
    const endDate = addMonths(startDate, months);
    return format(endDate, 'dd/MM/yyyy', { locale: vi });
  } catch {
    return null;
  }
}
