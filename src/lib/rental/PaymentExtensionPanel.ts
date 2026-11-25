// Port of hs-web-app components/contract/detail/PaymentExtensionPanel.tsx:12-15.
import { numberVi, vnDateTime } from '@/lib/rental/format';

export const dateTime = (s: string) => vnDateTime(s);
export const money = (n: number) => `${numberVi(n)} đ`;
// Extension-request states only (not contract states): no shared map exists for them.
export const statuses = {
  PENDING: 'Chờ chủ nhà duyệt',
  APPROVED: 'Đã đồng ý',
  REJECTED: 'Đã từ chối',
  EXPIRED: 'Hết hạn phản hồi',
  CLOSED: 'Đã đóng',
};
