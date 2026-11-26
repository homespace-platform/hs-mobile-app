// Port of getPublishableUses / isListingQuotaExhaustedError from hs-web-app lib/membership.ts.
import { isAxiosError } from 'axios';

type QuotaView = { remainingUses?: number; addonRemaining?: number; unlimited?: boolean };

export function getPublishableUses(membership?: QuotaView | null): number {
  return (membership?.remainingUses ?? 0) + (membership?.addonRemaining ?? 0);
}

/** Display only: the web never blocks the submit button, the server answers 409. */
export const isOutOfQuota = (membership?: QuotaView | null) =>
  Boolean(membership) && !membership!.unlimited && getPublishableUses(membership) === 0;

export function isListingQuotaExhaustedError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  const data = (error.response?.data ?? {}) as Record<string, unknown>;
  const code = data.code;
  const errorCode = String(data.errorCode ?? data.error ?? '').toUpperCase();
  const message = String(data.message ?? data.detail ?? '').toUpperCase();

  if (code === 4013 || String(code) === '4013') return true;
  if (String(code).toUpperCase() === 'LISTING_QUOTA_EXHAUSTED') return true;
  if (errorCode.includes('QUOTA_EXHAUSTED') || errorCode.includes('INSUFFICIENT_QUOTA'))
    return true;
  if (message.includes('LISTING_QUOTA_EXHAUSTED') || message.includes('NO PUBLICATION USES REMAIN'))
    return true;
  return (
    status === 409 &&
    ['QUOTA', 'HẾT LƯỢT', 'KHÔNG ĐỦ LƯỢT', 'LƯỢT ĐĂNG'].some((text) => message.includes(text))
  );
}

export const QUOTA_EXHAUSTED_MESSAGE =
  'Không đủ lượt đăng tin khả dụng (409 LISTING_QUOTA_EXHAUSTED). Dữ liệu bài đăng được giữ nguyên — bạn có thể Lưu tin nháp miễn phí ngay!';
export const QUOTA_BANNER = {
  title: 'Bạn đã hết lượt đăng tin khả dụng — Nội dung bài đăng vẫn được giữ nguyên!',
  body: 'Hãy bấm "Lưu nháp" (miễn phí) để không mất dữ liệu vừa nhập, sau đó mua thêm lượt hoặc mua, nâng cấp gói để gửi duyệt.',
  action: 'Xem tùy chọn lưu nháp & mua lượt',
};
