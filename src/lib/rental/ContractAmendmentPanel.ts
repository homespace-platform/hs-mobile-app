// Port of the status labels and comparison-cell formatting in
// hs-web-app components/contract/detail/ContractAmendmentPanel.tsx:19-30.
import { formatAmendmentComparisonText } from '@/lib/rental/contract-amendment-comparison';
import { amendmentMoney as money } from '@/lib/rental/ContractAmendmentWorkspace';
import type { AmendmentComparison, AmendmentStatus } from '@/types/rental/contract-amendment.type';

export const labels: Record<AmendmentStatus, string> = {
  REQUESTED: 'Chờ người thuê duyệt nội dung',
  CHANGES_REQUESTED: 'Người thuê yêu cầu chỉnh lại',
  APPROVED: 'Đã thống nhất · Chờ ký số',
  SCHEDULED: 'Đã ký đủ · Chờ ngày áp dụng',
  APPLIED: 'Đã áp dụng',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút đề xuất',
  EXPIRED: 'Đã đóng vì hết hạn',
  SUPERSEDED: 'Đã có phiên bản mới',
  TENANT_REQUESTED: 'Người thuê đề nghị trao đổi',
  TENANT_ACCEPTED: 'Chủ nhà đang soạn phụ lục',
  TENANT_REJECTED: 'Chủ nhà đã từ chối yêu cầu',
  TENANT_EXPIRED: 'Đã đóng · Không xử lý trong thời hạn',
  TENANT_FULFILLED: 'Đã chuyển thành đề xuất phụ lục',
};

/** Text of one before/after cell of the comparison table. */
export function comparisonValue(r: Pick<AmendmentComparison, 'field'>, v: string): string {
  if (
    [
      'rentAmount',
      'financial.depositAmountValue',
      'policies.latePaymentFeeAmount',
      'policies.latePaymentFeeCap',
    ].includes(r.field) &&
    /^\d+(\.\d+)?$/.test(v)
  )
    return money(v);
  if (r.field === 'policies.latePaymentFeeMode')
    return (
      (
        {
          NONE: 'Không phạt',
          FIXED_ONCE: 'Phạt một lần',
          FIXED_PER_DAY: 'Phạt theo ngày',
        } as Record<string, string>
      )[v] ?? v
    );
  if (r.field === 'policies.latePaymentFeeGraceDays' && v === '0')
    return 'Không thêm ngày ân hạn sau deadline (quy tắc hệ thống)';
  return formatAmendmentComparisonText(r.field, v);
}
