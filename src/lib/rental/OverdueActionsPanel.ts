// Port of hs-web-app components/contract/detail/OverdueActionsPanel.tsx:12-25.
import { vnDateTime } from '@/lib/rental/format';
import type { OverdueActionType } from '@/types/rental/monthly-invoice.type';

export const labels: Record<OverdueActionType, string> = {
  PAYMENT_REQUEST: 'Yêu cầu thanh toán và liên hệ người thuê',
  EXTENSION_PROPOSAL: 'Đề xuất gia hạn thanh toán',
  MUTUAL_TERMINATION_PROPOSAL: 'Đề nghị hai bên chấm dứt sớm và bàn giao',
  LEGAL_REVIEW: 'Thông báo xem xét biện pháp pháp lý',
  AUTOMATIC_ROLLOVER: 'Hệ thống tự cộng dồn công nợ sang kỳ sau',
  UNILATERAL_TERMINATION_NOTICE: 'Thông báo đơn phương chấm dứt',
  TERMINATION_REVIEW_REQUESTED: 'Người thuê khiếu nại xin đổi phương án',
  TERMINATION_REVIEW_DECIDED: 'Quyết định xử lý khiếu nại/chấm dứt',
  TERMINATION_ENDED: 'Hợp đồng chấm dứt theo quyết định đơn phương',
  TERMINATION_HANDOVER: 'Đã xác nhận nhận lại phòng',
};

export const dateTime = (value: string) => vnDateTime(value);
