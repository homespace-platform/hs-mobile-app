// Web MonthlyInvoicesSection.tsx:443-475: pay one invoice, or check the tenant's proof.
import { Image, Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import InfoRow from '@/components/rental/shared/InfoRow';
import { money } from '@/lib/rental/MonthlyInvoicesSection';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

import { ProofField, StorageLinks } from './common';
import type { BoundProof, invoiceCardState } from './logic';

export default function InvoiceTransferBlock({
  payment,
  state,
  isLandlord,
  busy,
  proof,
  onProof,
  onReport,
  onConfirm,
  onReject,
}: {
  payment: PaymentRequest;
  state: ReturnType<typeof invoiceCardState>;
  isLandlord: boolean;
  /** An action of the section is running. */
  busy: boolean;
  proof: BoundProof | undefined;
  onProof: (proof: BoundProof | undefined) => void;
  onReport: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const bank = payment.payeeBankAccountSnapshot;
  const evidences = payment.evidences ?? [];
  return (
    <View className="gap-3 rounded-2xl border border-border bg-background p-3">
      <Text accessibilityRole="header" className="text-base font-bold text-foreground">
        Chuyển khoản trực tiếp cho chủ nhà
      </Text>
      <View>
        <InfoRow label="Ngân hàng" value={bank?.bankName || bank?.bankCode || ''} />
        <InfoRow label="Số tài khoản" value={bank?.accountNumber ?? ''} />
        <InfoRow label="Người nhận" value={bank?.accountHolderName ?? ''} />
        <InfoRow label="Số tiền" value={money(payment.totalAmount)} strong />
        <InfoRow label="Nội dung chuyển khoản" value={payment.transferReference} stacked mono />
      </View>
      {state.showQr ? (
        <Image
          source={{ uri: payment.qrImageUrl }}
          accessible
          accessibilityLabel="VietQR thanh toán hóa đơn"
          resizeMode="contain"
          className="h-[180px] w-[180px] self-center rounded-xl border border-border bg-muted"
        />
      ) : null}
      {state.showReport ? (
        <ProofField
          // A draft belongs to one payment.
          key={payment.id}
          label="Chứng từ chuyển khoản (ảnh hoặc PDF, tối đa 15 MB)"
          sizeMessage="Chứng từ tối đa 15 MB."
          payment={payment}
          proof={proof}
          onProof={onProof}
          busy={busy}
          onSend={onReport}
        />
      ) : null}
      {payment.status === 'TRANSFER_REPORTED' ? (
        <Text className="text-sm leading-6 text-primary">
          {isLandlord
            ? 'Người thuê đã báo chuyển và gửi chứng từ — vui lòng kiểm tra và xác nhận đã nhận tiền.'
            : 'Đã báo chuyển, đã gửi chứng từ — chờ chủ nhà xác nhận.'}
        </Text>
      ) : null}
      {payment.status === 'REJECTED' ? (
        <Text accessibilityRole="alert" className="text-sm leading-6 text-danger">
          Chủ nhà chưa chấp nhận chứng từ:{' '}
          {payment.rejectedReason || 'Vui lòng kiểm tra và gửi lại.'}
        </Text>
      ) : null}
      {evidences.length > 0 ? (
        <View>
          <Text className="text-sm font-bold text-foreground">Chứng từ đã gửi:</Text>
          <StorageLinks
            ids={evidences.map((evidence) => evidence.storageObjectId)}
            label="Xem chứng từ"
            fallback="Không thể mở chứng từ."
          />
        </View>
      ) : null}
      {state.showDecision ? (
        <View className="gap-3">
          <ActionButton
            label="Xác nhận đã nhận tiền"
            variant="success"
            icon="checkmark-circle-outline"
            disabled={busy}
            onClick={onConfirm}
          />
          <ActionButton
            label="Không chấp nhận chứng từ"
            variant="danger"
            disabled={busy}
            onClick={onReject}
          />
        </View>
      ) : null}
    </View>
  );
}
