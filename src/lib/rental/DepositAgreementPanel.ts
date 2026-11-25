// Port of the label maps in hs-web-app components/rental-request/DepositAgreementPanel.tsx:22-25 and :134.
export const labels: Record<string, string> = {
  DRAFT: 'Đã lập · Chờ chủ nhà ký',
  LANDLORD_SIGNATURE_PENDING: 'Chủ nhà đang ký',
  TENANT_SIGNATURE_PENDING: 'Chờ khách thuê ký',
  ACTIVE: 'Đã ký đủ hai bên',
  CLOSED: 'Đã hoàn tất HĐ cọc',
  CANCELLED: 'Hồ sơ đã hủy',
  TERMINATED: 'Đã chấm dứt HĐ cọc',
};

const obligationLabels: Record<string, string> = {
  RESERVATION_PENDING: 'Đang giữ chỗ; chữ ký không thay cho nhận nhà',
  TRANSFERRED_TO_LEASE: 'Nghĩa vụ giữ chỗ đã chuyển sang HĐ thuê · Cọc tiếp tục bảo đảm HĐ thuê',
  REFUND_DUE: 'Còn nghĩa vụ hoàn cọc',
  REFUNDED: 'Đã xác nhận hoàn cọc',
  RETAINED_BY_LANDLORD: 'Đã xử lý khoản giữ lại theo hồ sơ',
  DISPUTED: 'Đang đối soát / khiếu nại',
  ENDED: 'Đã kết thúc; xem sổ cọc và lịch sử',
};
/** Shown as `Nghĩa vụ cọc: {obligationLabel(view.obligation)}.` */
export const obligationLabel = (obligation: string) =>
  obligationLabels[obligation] ?? 'Đang được theo dõi';
