// Web app/dashboard/payments/page.tsx, only as the PAYMENT_* notification target: find the id in the caller's
// own list (it is never sent to an endpoint) and move on to the screen that handles that payment.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/Screen';
import { findOwnPayment } from '@/components/rental/billing/logic';
import { useViewer } from '@/components/rental/requests/useViewer';
import ActionButton from '@/components/rental/shared/ActionButton';
import InfoRow from '@/components/rental/shared/InfoRow';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { PAYMENT_NOT_FOUND } from '@/lib/rental-nav/deep-link';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';
import { currencyVnd } from '@/lib/rental/format';
import { paymentLink } from '@/lib/rental/payment-link';
import { paymentRequestService } from '@/services/rental/payment-request.service';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

export type PaymentLinkScreenProps = RentalScreenNavProps & {
  paymentId: string;
};

const LOADING = 'Đang tải dữ liệu...';

export default function PaymentLinkScreen({
  paymentId,
  onBack,
  onNavigate,
}: PaymentLinkScreenProps) {
  const { userId, failed, retry } = useViewer();
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Yêu cầu chuyển khoản" onBack={onBack} />
      <ScrollView contentContainerClassName="gap-4 p-4">
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
  onNavigate,
}: {
  userId: string;
  paymentId: string;
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
      const link = found ? paymentLink(found, userId) : null;
      if (link) navigate.current(link.href, { replace: true });
      else setResult(found ?? 'missing');
    } catch {
      if (token === sequence.current.value) setResult('failed');
    }
  }, [paymentId, userId]);
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
  // The viewer's own payment without any page that acts on it (no contract): show what identifies it.
  return (
    <View className="rounded-2xl border border-border bg-surface p-4">
      <InfoRow label="Số tiền" value={currencyVnd(result.totalAmount)} strong />
      <InfoRow label="Nội dung chuyển khoản" value={result.transferReference} stacked />
    </View>
  );
}
