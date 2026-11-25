// Web: components/contract/detail/ContractInitialPaymentSection.tsx.
import { Text, View } from 'react-native';

import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { vnDateTime } from '@/lib/rental/format';
import { formatMoney, isZeroDeposit, str } from '@/lib/rental/utils';
import type { TermRow } from '@/types/rental/contract-amendment.type';

import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { FieldRow, NoticeText, RowCard, Section } from './fields';

const time = (value: unknown) => {
  if (value == null || value === '') return 'Chưa ghi nhận';
  const raw = String(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;
  return Number.isNaN(new Date(raw).getTime()) ? raw : vnDateTime(raw);
};
const STATUS: Record<string, string> = {
  CONFIRMED: 'Hai bên đã xác nhận',
  PAID: 'Đã thanh toán',
  PAID_MOCK: 'Thanh toán thử nghiệm',
  PENDING: 'Chờ xác nhận',
  UNPAID: 'Chưa thanh toán',
};
const status = (value: unknown) => STATUS[String(value)] ?? str(value);
const NO_DEPOSIT_PAYMENT = 'Không phát sinh thanh toán tiền cọc';

function PaymentLine({ name, amount, note }: { name: string; amount: string; note: string }) {
  return (
    <RowCard title={<Text className="text-sm font-bold text-foreground">{name}</Text>}>
      <InfoRow label="Số tiền" value={amount} />
      <InfoRow label="Chi tiết ghi nhận" value={note} />
    </RowCard>
  );
}

/** Historical snapshot, never recalculated from rent/deposit proposed in an amendment. */
export default function ContractInitialPaymentSection({
  initialPayment,
}: {
  initialPayment?: TermRow | null;
}) {
  const w = useAmendmentWorkspace();
  const p: TermRow = w?.data?.currentTerms.initialPayment ?? initialPayment ?? {};
  const rows = Array.isArray(p.rows) ? (p.rows as TermRow[]) : [];
  return (
    <Section icon="receipt-outline" title="Ghi nhận thanh toán ban đầu">
      <PolicyNotice
        tone="neutral"
        title="Ghi nhận thanh toán ban đầu"
        summary="Dữ liệu lịch sử tại thời điểm lập hợp đồng · Chỉ đọc.">
        <NoticeText>
          Dữ liệu lịch sử tại thời điểm lập hợp đồng · Chỉ đọc. Phụ lục không sửa giao dịch đã xác
          nhận hoặc thu lại khoản này.
        </NoticeText>
      </PolicyNotice>
      {rows.length ? (
        rows.map((row, i) => (
          <PaymentLine
            key={i}
            name={str(row.itemName)}
            amount={str(row.amountText)}
            note={
              row.itemName === 'Tiền đặt cọc' && isZeroDeposit(row.amountText)
                ? NO_DEPOSIT_PAYMENT
                : str(row.note)
            }
          />
        ))
      ) : (
        <>
          <PaymentLine
            name="Tiền thuê kỳ đầu"
            amount={formatMoney(p.monthlyRent)}
            note={status(p.status)}
          />
          <PaymentLine
            name="Tiền đặt cọc ban đầu"
            amount={formatMoney(p.depositAmount)}
            note={isZeroDeposit(p.depositAmount) ? NO_DEPOSIT_PAYMENT : status(p.status)}
          />
        </>
      )}
      <View>
        <FieldRow label="Trạng thái xác nhận" value={status(p.status)} />
        <FieldRow label="Tổng tiền ban đầu" value={formatMoney(p.totalAmount)} />
        <FieldRow label="Người thuê báo chuyển" value={time(p.payerReportedAt)} />
        <FieldRow label="Chủ nhà xác nhận nhận" value={time(p.payeeConfirmedAt)} />
        <FieldRow label="Hoàn tất xác nhận hai chiều" value={time(p.confirmedAt)} />
        <FieldRow label="Nội dung chuyển khoản" value={p.transferReference} />
        <FieldRow label="Mã giao dịch ngân hàng" value={p.bankTransactionReference} />
        <FieldRow label="Thời điểm thanh toán đã lưu" value={time(p.paidAt)} />
        <FieldRow label="Mã tham chiếu thanh toán đã lưu" value={p.transactionCode} />
      </View>
    </Section>
  );
}
