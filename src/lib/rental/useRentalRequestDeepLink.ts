// Port of the rules inside hs-web-app components/rental-request/useRentalRequestDeepLink.ts (:10,49-82).
// Reading and clearing the `requestId` parameter belongs to mobile navigation.
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isRentalRequestId = (value: string) => UUID.test(value);

export const DEEP_LINK_INVALID = 'Liên kết yêu cầu thuê không hợp lệ.';
export const DEEP_LINK_WRONG_SIDE = 'Yêu cầu thuê không thuộc phía tài khoản bạn đang xem.';

/** Never infer page ownership from a 200: the verified user must be on this side. */
export function isRequestOnSide(
  request: Pick<RentalRequestResponse, 'id' | 'ownerId' | 'renterId'>,
  requestedId: string,
  mode: 'RECEIVED' | 'SENT',
  userId: string
): boolean {
  const ownerSide = mode === 'RECEIVED' ? request.ownerId : request.renterId;
  return request.id === requestedId && ownerSide === userId;
}

/** 403/404 is an info notice, anything else an error. */
export function deepLinkLoadError(error: unknown): { type: 'info' | 'error'; message: string } {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 403 || status === 404
    ? { type: 'info', message: 'Yêu cầu thuê không còn tồn tại hoặc bạn không có quyền xem.' }
    : { type: 'error', message: 'Không thể mở yêu cầu thuê lúc này. Vui lòng thử lại.' };
}
