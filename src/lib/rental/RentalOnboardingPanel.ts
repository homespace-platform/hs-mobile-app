// Port of the constants and rules in hs-web-app components/rental-request/RentalOnboardingPanel.tsx
// (:25-27, :32-58, :84, :202-203).
import { numberVi, vnDateTime } from '@/lib/rental/format';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';

export const date = (s: string) => s.split('T')[0].split('-').reverse().join('/');
export const instant = (s?: string) => (s ? vnDateTime(s) : '—');
export const money = (n: number) => numberVi(n) + ' đ';

export const HISTORY_ACTIONS: Record<string, string> = {
  CANCELLATION_REQUESTED: 'Đề nghị hủy và hoàn tiền',
  CANCELLATION_APPROVED: 'Đồng ý hủy và hoàn tiền',
  CANCELLATION_REJECTED: 'Không đồng ý hủy',
  PAYMENT_RECEIPT_VERIFIED: 'Đã đối soát nhận đủ tiền',
  PAYMENT_REOPENED: 'Mở lại thanh toán',
  SIGNING_REOPENED: 'Mở lại thời hạn ký',
  DEPOSIT_AGREEMENT_CREATED: 'Đã lập hợp đồng cọc',
  DEPOSIT_LANDLORD_SIGNED: 'Chủ nhà đã ký cọc',
  DEPOSIT_BOTH_SIGNED: 'Đã ký đủ hợp đồng cọc',
  DEPOSIT_SIGNING_REOPENED: 'Mở lại hạn ký cọc',
  DEFAULT_NOTICE: 'Chủ nhà gửi thông báo quá hạn',
  DEFAULT_DISPUTED: 'Người thuê phản hồi thông báo quá hạn',
  DEFAULT_COMPLETED: 'Chủ nhà giữ cọc và hủy hồ sơ',
  OWNER_CANCELLED_UNPAID: 'Chủ nhà hủy hồ sơ chưa thanh toán',
  TENANT_CANCELLED_UNPAID: 'Người thuê hủy hồ sơ chưa thanh toán',
  NO_DEPOSIT_HOLD_CANCELLED: 'Hệ thống hủy giữ phòng do quá hạn',
  NO_DEPOSIT_FIRST_RENT_NOTICE: 'Thông báo quá hạn tiền thuê tháng đầu',
};

export const CANCEL_RULES_TITLE = 'Khi nào hủy được, và tiền xử lý thế nào';
export const CANCEL_RULE_ACTIVE_SUFFIX = ' · đang áp dụng cho hồ sơ này';
/** The three cancel rules in plain words; the one that applies to this request right now is `active`. */
export function cancelRules(forfeit: boolean) {
  return [
    {
      key: 'lease',
      title: 'Hợp đồng thuê đã ký đủ hai bên',
      body: 'Không hủy được ở đây. Dùng chấm dứt hợp đồng.',
      active: false,
    },
    {
      key: 'deposit',
      title: 'Hợp đồng cọc đã ký đủ, hợp đồng thuê chưa ký đủ',
      body: 'Hủy được. Tiền cọc không được hoàn; tiền thuê tháng đầu (nếu đã nhận) được hoàn.',
      active: forfeit,
    },
    {
      key: 'other',
      title: 'Các trường hợp còn lại',
      body: 'Hủy được và hoàn toàn bộ khoản đã nhận.',
      active: !forfeit,
    },
  ];
}

/** Fully signed deposit agreement: cancelling forfeits the deposit (server enforces; this is display only). */
export const depositForfeit = (
  view: Pick<RentalOnboarding, 'depositAgreementStatus'> | null | undefined
) =>
  !!view &&
  ['ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED'].includes(view.depositAgreementStatus ?? '');

/** Backend refuses to approve a cancellation while a deposit / first-rent transfer is still unreconciled. */
export const unreconciled = (view: Pick<RentalOnboarding, 'payments'> | null | undefined) =>
  !!view?.payments.some(
    (p) =>
      (p.type === 'RESERVATION_DEPOSIT' || p.type === 'INITIAL') && p.status === 'TRANSFER_REPORTED'
  );

/** A confirmed 0 đ reservation deposit is not shown as a payment. */
export const visiblePayments = (view: Pick<RentalOnboarding, 'payments'> | null | undefined) =>
  view?.payments.filter(
    (p) => !(p.type === 'RESERVATION_DEPOSIT' && p.totalAmount === 0 && p.status === 'CONFIRMED')
  ) ?? [];
