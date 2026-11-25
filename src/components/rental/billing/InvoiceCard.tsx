// Web MonthlyInvoicesSection.tsx:362-477: one invoice. The draft form, the payment block and the two
// overdue panels are passed in or mounted here.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import Badge from '@/components/rental/shared/Badge';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { invoiceLineCalculation } from '@/lib/rental/InvoiceLineCalculation';
import {
  invoicePeriodLabel,
  invoicePeriodSecondaryLabel,
  invoiceStatusPresentation,
} from '@/lib/rental/invoice-status';
import { date, dateTime, money } from '@/lib/rental/MonthlyInvoicesSection';
import type { Tone } from '@/lib/rental/rental-labels';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

import { Notice, StorageLinks, ToneBox } from './common';
import { invoiceMessage, type invoiceCardState } from './logic';
import { MeterReadingSummary } from './MeterReading';
import OverdueActionsPanel from './OverdueActionsPanel';
import PaymentExtensionPanel from './PaymentExtensionPanel';
import PaymentReceiptActions from './PaymentReceiptActions';

const KIND_TONES: Record<ReturnType<typeof invoiceStatusPresentation>['kind'], Tone> = {
  cancelled: 'neutral',
  draft: 'neutral',
  rolled: 'neutral',
  unknown: 'neutral',
  paid: 'success',
  awaiting_confirm: 'info',
  rejected: 'danger',
  overdue: 'danger',
  unpaid: 'warning',
};

export function InvoiceStatusBadge({
  invoice,
  paymentStatus,
}: {
  invoice: MonthlyInvoice;
  paymentStatus?: PaymentRequest['status'];
}) {
  const status = invoiceStatusPresentation(invoice, paymentStatus);
  return <Badge tone={KIND_TONES[status.kind]}>{status.label}</Badge>;
}

const Line = ({ children }: { children: ReactNode }) => (
  <Text className="text-sm leading-6 text-muted-foreground">{children}</Text>
);

export default function InvoiceCard({
  invoice,
  payment,
  state,
  contractActive,
  isLandlord,
  isTenant,
  refresh,
  refreshAll,
  onTerminated,
  draftForm,
  transfer,
}: {
  invoice: MonthlyInvoice;
  payment: PaymentRequest | undefined;
  state: ReturnType<typeof invoiceCardState>;
  contractActive: boolean;
  isLandlord: boolean;
  isTenant: boolean;
  refresh: () => Promise<void>;
  /** Invoices and the contract around them. */
  refreshAll: () => Promise<void>;
  onTerminated?: () => void;
  draftForm: ReactNode;
  transfer: ReactNode;
}) {
  const { firstRent, countdown } = state;
  const secondary = invoicePeriodSecondaryLabel(invoice);
  const message = invoiceMessage(invoice, payment?.status);
  const period = invoice.billingPeriod;
  return (
    <View className="gap-4 rounded-2xl border border-border bg-surface p-4">
      <View className="gap-2">
        <InvoiceStatusBadge invoice={invoice} paymentStatus={payment?.status} />
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
          {invoicePeriodLabel(invoice)}
        </Text>
        {state.showTotal ? (
          <Text className="text-2xl font-bold text-foreground">{money(invoice.totalAmount)}</Text>
        ) : null}
        <Text className="text-sm leading-6 text-foreground">
          {invoice.status === 'DRAFT' ? (
            'Chỉ chủ nhà thấy bản nháp; người thuê thấy sau khi phát hành'
          ) : (
            <>
              Hạn thanh toán: {dateTime(invoice.dueAt)}
              {countdown ? (
                <Text className={`font-bold ${countdown.late ? 'text-danger' : 'text-foreground'}`}>
                  {' '}
                  · {countdown.text}
                </Text>
              ) : null}
            </>
          )}
        </Text>
        {secondary ? <Line>{secondary}</Line> : null}
        <Line>
          {firstRent
            ? 'Tiền thuê tháng 1'
            : invoice.finalCostSupplement
              ? 'Chi phí bổ sung'
              : `Chi phí tháng ${invoice.periodIndex + 1}`}
          : {date(invoice.periodStart)} – trước {date(invoice.periodEndExclusive)}
        </Line>
        {period?.kind === 'RECURRING' ? (
          <Line>
            Tiền phòng tháng {period.paymentPeriodNumber}:{' '}
            {date(period.rentPeriodStart || undefined)} – trước{' '}
            {date(period.rentPeriodEndExclusive || undefined)}
          </Line>
        ) : null}
        {period?.kind === 'FINAL_SETTLEMENT' ? (
          <PolicyNotice
            tone="neutral"
            title="Hóa đơn kỳ cuối"
            summary="Chỉ thu chi phí kỳ cuối và công nợ (nếu có), không thu tiền phòng tháng kế tiếp.">
            <Notice>
              Chỉ thu chi phí kỳ cuối và công nợ (nếu có), không thu tiền phòng tháng kế tiếp. Thanh
              toán đủ trước khi hoàn cọc.
            </Notice>
          </PolicyNotice>
        ) : null}
      </View>
      {message.summary ? (
        <PolicyNotice
          tone={message.warn ? 'warning' : 'info'}
          title="Trạng thái hóa đơn"
          summary={message.summary}>
          <Notice>{message.text}</Notice>
        </PolicyNotice>
      ) : (
        <ToneBox tone={message.warn ? 'warning' : 'info'}>{message.text}</ToneBox>
      )}
      {state.showLateRule ? (
        <PolicyNotice
          tone="neutral"
          title="Phạt chậm thanh toán"
          summary="Phạt chậm thanh toán tối đa 5 ngày theo mức trần của hợp đồng.">
          <Notice>
            Phạt chậm thanh toán tối đa 5 ngày theo đơn giá và mức trần của hợp đồng. Hết 10 ngày
            quá hạn chưa có phương án xử lý, hệ thống tự chốt nợ để cộng dồn nếu còn kỳ sau chưa
            phát hành; kỳ cuối giữ hóa đơn riêng để quyết toán.
          </Notice>
        </PolicyNotice>
      ) : null}
      {state.showDraftForm ? draftForm : null}
      {state.showLines ? (
        <View className="rounded-2xl border border-border px-3">
          {invoice.lines.map((line, index) => {
            const { formula, capNote } = invoiceLineCalculation(line);
            return (
              <View key={index} className="border-b border-border py-3">
                <View className="flex-row items-start gap-3">
                  <View className="flex-1">
                    <Text className="text-sm leading-6 text-foreground">
                      {line.description}{' '}
                      <Text className="text-xs text-muted-foreground">{formula}</Text>
                    </Text>
                    {capNote ? <Line>{capNote}</Line> : null}
                  </View>
                  <Text className="text-sm font-bold leading-6 text-foreground">
                    {money(line.amount)}
                  </Text>
                </View>
                {line.type === 'ELECTRICITY' ? (
                  <MeterReadingSummary
                    start={invoice.electricityStart}
                    end={invoice.electricityEnd}
                    quantity={line.quantity}
                    unit="kWh"
                  />
                ) : null}
                {line.type === 'WATER' ? (
                  <MeterReadingSummary
                    start={invoice.waterStart}
                    end={invoice.waterEnd}
                    quantity={line.quantity}
                    unit="m³"
                  />
                ) : null}
              </View>
            );
          })}
          <View className="flex-row items-center justify-between gap-3 py-3">
            <Text className="flex-1 text-base font-bold text-foreground">
              {invoice.status === 'ROLLED_OVER' ? 'Đã chuyển sang kỳ sau' : 'Tổng hóa đơn'}
            </Text>
            <Text className="text-base font-bold text-foreground">
              {money(invoice.totalAmount)}
            </Text>
          </View>
        </View>
      ) : null}
      {state.showLines && (invoice.electricityAutoFilled || invoice.waterAutoFilled) ? (
        <ToneBox tone="warning">
          {`Chỉ số ${invoice.electricityAutoFilled && invoice.waterAutoFilled ? 'điện và nước' : invoice.electricityAutoFilled ? 'điện' : 'nước'} được hệ thống tạm điền bằng chỉ số đầu kỳ do chưa cập nhật trong 24 giờ. Phần tiêu thụ tạm tính bằng 0, không phải số đo thực tế.`}
        </ToneBox>
      ) : null}
      {state.showLateFee ? (
        <Text className="text-sm leading-6 text-danger">
          Trong tổng trên có {money(invoice.lateFeeAmount)} phí chậm thanh toán.{' '}
          {invoice.lateFeeExempt
            ? 'Phí đã chốt, không tăng thêm cho hóa đơn này.'
            : 'Nếu đã chuyển tiền, hãy gửi chứng từ để tạm dừng tăng phí.'}
        </Text>
      ) : null}
      {state.showResolutionPanels ? (
        <>
          <PaymentExtensionPanel
            invoice={invoice}
            isLandlord={isLandlord}
            isTenant={isTenant}
            refresh={refresh}
          />
          <OverdueActionsPanel
            invoice={invoice}
            contractActive={contractActive}
            isLandlord={isLandlord}
            isTenant={isTenant}
            refresh={refreshAll}
            onTerminated={onTerminated}
          />
        </>
      ) : null}
      {state.showOriginalAmount && payment ? (
        <PolicyNotice
          tone="neutral"
          title="Khoản chuyển gốc"
          summary="Chỉ chuyển một lần theo QR gốc; không cộng cọc vào tổng hóa đơn tiền thuê.">
          <Notice>
            Khoản chuyển gốc {money(payment.totalAmount)} bao gồm tiền thuê{' '}
            {money(invoice.totalAmount)} và cọc theo bảng kê. Chỉ chuyển một lần theo QR gốc; không
            cộng cọc vào tổng hóa đơn tiền thuê.
          </Notice>
        </PolicyNotice>
      ) : null}
      {state.showOriginalProof && payment ? (
        <View className="gap-1 rounded-2xl border border-border bg-background p-3">
          <Text selectable className="text-sm leading-6 text-foreground">
            Khoản chuyển gốc: <Text className="font-bold">{payment.transferReference}</Text> · Đã
            xác nhận: {dateTime(payment.confirmedAt)}
          </Text>
          <StorageLinks
            ids={payment.evidences?.map((evidence) => evidence.storageObjectId)}
            label="Xem chứng từ"
            fallback="Không thể mở chứng từ."
          />
        </View>
      ) : null}
      {state.showTransfer ? transfer : null}
      {state.showReceipt && payment ? <PaymentReceiptActions paymentId={payment.id} /> : null}
    </View>
  );
}
