// Web app/dashboard/payments/page.tsx, only as the PAYMENT_* notification target: find the id in the caller's
// own list (it is never sent to an endpoint) and move on to the screen that handles that payment.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/Screen';
import { findOwnPayment } from '@/components/rental/billing/logic';
import SettlementPaymentPanel from '@/components/rental/billing/SettlementPaymentPanel';
import { useViewer } from '@/components/rental/requests/useViewer';
import ActionButton from '@/components/rental/shared/ActionButton';
import InfoRow from '@/components/rental/shared/InfoRow';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { PAYMENT_NOT_FOUND } from '@/lib/rental-nav/deep-link';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';
import { currencyVnd } from '@/lib/rental/format';
import { isSettlementTransfer, paymentLink } from '@/lib/rental/payment-link';
import { useNotificationChangeSync } from '@/lib/rental-sync/hooks';
import { paymentRequestService } from '@/services/rental/payment-request.service';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

export type PaymentLinkScreenProps = RentalScreenNavProps & {
  paymentId: string;
  /** Handle a refund or settlement transfer here (one tap from "Cần chú ý"), as the web card does. */
  actHere?: boolean;
};

const LOADING = 'Đang tải dữ liệu...';

export default function PaymentLinkScreen({
  paymentId,
  actHere,
  onBack,
  onNavigate,
}: PaymentLinkScreenProps) {
  const { userId, failed, retry } = useViewer();
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Yêu cầu chuyển khoản" onBack={onBack} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-4 p-4">
        {failed ? (
          <ErrorBlock
            message="Yêu cầu chuyển khoản chỉ hiển thị cho các bên liên quan."
            onRetry={retry}
          />
        ) : userId ? (
          <Lookup
            key={`${userId}:${paymentId}`}
            userId={userId}
            paymentId={paymentId}
            actHere={actHere}
            onNavigate={onNavigate}
          />
        ) : (
          <LoadingBlock label={LOADING} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Lookup({
  userId,
  paymentId,
  actHere,
  onNavigate,
}: {
  userId: string;
  paymentId: string;
  actHere?: boolean;
  onNavigate: RentalScreenNavProps['onNavigate'];
}) {
  const [result, setResult] = useState<PaymentRequest | 'missing' | 'failed' | null>(null);
  const sequence = useRef({ value: 0 });
  const navigate = useRef(onNavigate);
  useEffect(() => {
    navigate.current = onNavigate;
  });

  const load = useCallback(async () => {
    const token = ++sequence.current.value;
    setResult(null);
    try {
      const list = await paymentRequestService.getMyPaymentRequests();
      if (token !== sequence.current.value) return;
      const found = findOwnPayment(list, paymentId, userId);
      const here = Boolean(actHere && found && isSettlementTransfer(found));
      const link = found && !here ? paymentLink(found, userId) : null;
      if (link) navigate.current(link.href, { replace: true });
      else setResult(found ?? 'missing');
    } catch {
      if (token === sequence.current.value) setResult('failed');
    }
  }, [paymentId, userId, actHere]);
  useEffect(() => {
    const counter = sequence.current;
    void load();
    return () => {
      counter.value++;
    };
  }, [load]);

  if (result === null) return <LoadingBlock label={LOADING} />;
  if (result === 'failed')
    return (
      <ErrorBlock
        message="Không thể tải danh sách yêu cầu chuyển khoản."
        onRetry={() => void load()}
      />
    );
  if (result === 'missing')
    return (
      <View className="gap-3">
        <Text
          accessibilityRole="alert"
          className="rounded-2xl border border-warning bg-warning-soft p-4 text-sm leading-6 text-warning">
          {PAYMENT_NOT_FOUND}
        </Text>
        <ActionButton label="Tải lại" variant="secondary" onClick={() => void load()} />
      </View>
    );
  if (actHere && isSettlementTransfer(result)) {
    const link = paymentLink(result, userId);
    return (
      <Settlement
        payment={result}
        userId={userId}
        onChange={setResult}
        link={link ? { label: link.label, open: () => onNavigate(link.href) } : null}
      />
    );
  }
  // The viewer's own payment without any page that acts on it (no contract): show what identifies it.
  return (
    <View className="rounded-2xl border border-border bg-surface p-4">
      <InfoRow label="Số tiền" value={currencyVnd(result.totalAmount)} strong />
      <InfoRow label="Nội dung chuyển khoản" value={result.transferReference} stacked />
    </View>
  );
}

/** The transfer's own actions, re-read without unmounting the panel (a typed reason or proof stays). */
function Settlement({
  payment,
  userId,
  onChange,
  link,
}: {
  payment: PaymentRequest;
  userId: string;
  onChange: (payment: PaymentRequest) => void;
  link: { label: string; open: () => void } | null;
}) {
  const [stale, setStale] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const token = ++sequence.current;
    try {
      const list = await paymentRequestService.getMyPaymentRequests();
      const found = findOwnPayment(list, payment.id, userId);
      if (token !== sequence.current) return;
      if (found) onChange(found);
      setStale(!found);
    } catch {
      if (token === sequence.current) setStale(true);
    }
  }, [payment.id, userId, onChange]);
  useNotificationChangeSync((event) => event.type === 'payment-changed', refresh);
  const payerId = payment.direction === 'LANDLORD_TO_TENANT' ? payment.payerId : payment.payeeId;
  return (
    <View className="gap-3">
      {stale ? (
        <ErrorBlock
          message="Chưa tải lại được khoản này, thông tin có thể đã cũ."
          onRetry={() => void refresh()}
        />
      ) : null}
      <SettlementPaymentPanel
        key={payment.id}
        payment={payment}
        isLandlord={userId === payerId}
        refresh={refresh}
      />
      {link ? <ActionButton label={link.label} variant="secondary" onClick={link.open} /> : null}
    </View>
  );
}
