// Web: components/rental-request/OnboardingPaymentCard.tsx.
import { Text, View } from 'react-native';

import PaymentReceiptActions from '@/components/rental/billing/PaymentReceiptActions';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { Card } from '@/components/rental/shared/Card';
import { instant, isRefundPayment, money } from '@/lib/rental/OnboardingPaymentCard';
import { reservationPaymentTitle } from '@/lib/rental/rental-deposit-quick-view';
import { paymentStatus } from '@/lib/rental/rental-labels';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

import { paymentCardState } from './logic';

export type PaymentCardAction =
  'pay' | 'confirm' | 'reject' | 'reviewOk' | 'reviewReopen' | 'proof';

/** One payment: what it is, how much, until when, its status and ONE main button for the viewer. */
export default function OnboardingPaymentCard({
  payment: p,
  view,
  isOwner,
  busy,
  onAction,
}: {
  payment: PaymentRequest;
  view: RentalOnboarding;
  isOwner: boolean;
  busy: boolean;
  onAction: (
    action: PaymentCardAction,
    payment: PaymentRequest,
    evidenceStorageId?: string
  ) => void;
}) {
  const { statusKey, canPay, canReceive, canReview, countdown } = paymentCardState(
    p,
    view,
    isOwner
  );
  const status = paymentStatus(statusKey);

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          {reservationPaymentTitle(p)}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {p.direction === 'LANDLORD_TO_TENANT'
            ? 'Chủ nhà chuyển cho người thuê'
            : 'Người thuê chuyển cho chủ nhà'}
        </Text>
        <Text selectable className="text-2xl font-extrabold text-foreground">
          {money(p.totalAmount)}
        </Text>
      </View>
      <View className="gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {countdown ? (
          <Badge tone={countdown.late ? 'danger' : 'warning'} icon="time-outline">
            {`${countdown.text} · hạn ${instant(p.dueAt)}`}
          </Badge>
        ) : null}
        {p.status === 'CONFIRMED' ? (
          <Text className="text-xs text-muted-foreground">
            Xác nhận lúc {instant(p.confirmedAt)}
          </Text>
        ) : null}
        {p.status === 'TRANSFER_REPORTED' && p.confirmationDueAt && !isRefundPayment(p) ? (
          <Text className="text-xs text-muted-foreground">
            Hạn xác nhận {instant(p.confirmationDueAt)}
          </Text>
        ) : null}
      </View>
      {p.transferReference ? (
        <View className="rounded-xl bg-muted px-3 py-2">
          <Text selectable className="text-sm leading-6 text-muted-foreground">
            Nội dung chuyển khoản:{' '}
            <Text className="font-mono font-semibold text-foreground">{p.transferReference}</Text>
          </Text>
        </View>
      ) : null}
      {p.rejectedReason ? (
        <Text className="text-sm text-muted-foreground">
          Lý do chưa xác nhận: {p.rejectedReason}
        </Text>
      ) : null}

      {canPay ? (
        <ActionButton
          label={p.status === 'REJECTED' ? 'Gửi lại chứng từ' : 'Chuyển khoản / Gửi chứng từ'}
          disabled={busy}
          onClick={() => onAction('pay', p)}
        />
      ) : null}
      {canReceive ? (
        <>
          <ActionButton
            label="Xác nhận đã nhận đủ tiền"
            disabled={busy}
            onClick={() => onAction('confirm', p)}
          />
          <ActionButton
            label="Chưa nhận đủ / Từ chối chứng từ"
            variant="secondary"
            disabled={busy}
            onClick={() => onAction('reject', p)}
          />
        </>
      ) : null}
      {canReview ? (
        <>
          <ActionButton
            label="Xác nhận đã nhận đủ"
            disabled={busy}
            onClick={() => onAction('reviewOk', p)}
          />
          <ActionButton
            label="Chưa nhận: mở lại thanh toán"
            variant="secondary"
            disabled={busy}
            onClick={() => onAction('reviewReopen', p)}
          />
        </>
      ) : null}
      {p.evidences?.map((e, i) => (
        <ActionButton
          key={e.id}
          label={p.evidences.length > 1 ? `Xem chứng từ ${i + 1}` : 'Xem chứng từ'}
          icon="eye-outline"
          variant="secondary"
          onClick={() => onAction('proof', p, e.storageObjectId)}
        />
      ))}
      {p.status === 'CONFIRMED' && p.totalAmount > 0 ? (
        <PaymentReceiptActions paymentId={p.id} />
      ) : null}
    </Card>
  );
}
