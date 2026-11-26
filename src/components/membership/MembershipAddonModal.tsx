// Web components/membership/MembershipAddonModal: one-off extra uses. The order screen, the
// pending-order rule and the order status are the plan checkout's.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import ModalShell from '@/components/rental/shared/ModalShell';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { formatExactVnd, getMembershipErrorMessage } from '@/lib/membership';
import {
  placeMembershipOrder,
  type OrderMemory,
  type PlaceOrderResult,
} from '@/lib/membership-order';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import {
  cancelMembershipOrder,
  createMembershipAddonCheckout,
  getMembershipAddonOffer,
  type MembershipAddonOffer,
  type MembershipPaymentMethod,
} from '@/services/membershipApi';

import PaymentProviderPicker from './PaymentProviderPicker';
import PendingOrderNotice from './PendingOrderNotice';

export default function MembershipAddonModal({
  starterPriceVnd,
  memory,
  onClose,
  onPlaced,
  onOpenOrder,
}: {
  /** Server price of the Starter plan; null hides the comparison hint. */
  starterPriceVnd: number | null;
  memory: OrderMemory;
  onClose: () => void;
  onPlaced: (order: Extract<PlaceOrderResult, { kind: 'ok' }>) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const gate = useFeatureGate(PERMISSIONS.MEMBERSHIP_PURCHASE);
  const [offer, setOffer] = useState<MembershipAddonOffer | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [provider, setProvider] = useState<MembershipPaymentMethod>('SEPAY');
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  const loadOffer = useCallback(async () => {
    setOfferError(null);
    try {
      const next = await getMembershipAddonOffer();
      setOffer(next);
      setQuantity((current) => Math.min(current, next.maxQuantity));
    } catch (cause) {
      setOffer(null);
      setOfferError(getMembershipErrorMessage(cause, 'Chưa tải được giá lượt mua thêm.'));
    }
  }, []);

  useEffect(() => {
    void loadOffer();
  }, [loadOffer]);

  const total = offer ? offer.unitPriceVnd * quantity : 0;
  const gateway = provider === 'ETH' ? 'MetaMask' : 'SePay';

  async function confirm() {
    if (!offer || lock.current || !gate.guard()) return;
    lock.current = true;
    setSubmitting(true);
    setError(null);
    setPendingOrderId(null);
    const result = await placeMembershipOrder({
      create: () => createMembershipAddonCheckout(quantity, provider),
      cancel: cancelMembershipOrder,
      memory,
      provider,
      expectedAmount: total,
    });
    lock.current = false;
    if (result.kind === 'ok') return onPlaced(result);
    setSubmitting(false);
    if (result.kind === 'price-changed') {
      // No payment button on the old price while the new one loads.
      setOffer(null);
      void loadOffer();
    }
    setError(result.message);
    setPendingOrderId(result.pendingOrderId);
  }

  return (
    <ModalShell
      title="Mua thêm lượt đăng tin"
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <View className="w-full gap-2">
          {gate.title ? <Text className="text-xs text-warning">{gate.title}</Text> : null}
          <ActionButton
            label={
              offer
                ? `Thanh toán ${formatExactVnd(total)} qua ${gateway}`
                : `Thanh toán qua ${gateway}`
            }
            busy={submitting}
            disabled={!offer || !gate.allowed}
            hint={gate.title}
            onClick={() => void confirm()}
          />
        </View>
      }>
      <View className="gap-3">
        {offer ? (
          <>
            <Text className="text-sm leading-5 text-muted-foreground">
              {formatExactVnd(offer.unitPriceVnd)}/lượt. Mỗi lượt dùng trong{' '}
              <Text className="font-bold text-foreground">{offer.validDays} ngày</Text>, quá hạn sẽ
              mất. Lượt gói được dùng trước; đổi gói không mất lượt mua thêm.
            </Text>
            <Text className="text-sm font-bold text-foreground">Số lượt</Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Số lượt"
              className="flex-row flex-wrap gap-2">
              {Array.from({ length: offer.maxQuantity }, (_, index) => index + 1).map((value) => {
                const selected = value === quantity;
                return (
                  <Pressable
                    key={value}
                    disabled={submitting}
                    onPress={() => setQuantity(value)}
                    accessibilityRole="radio"
                    accessibilityLabel={`${value} lượt`}
                    accessibilityState={{ checked: selected, disabled: submitting }}
                    className={`h-12 w-12 items-center justify-center rounded-xl border ${selected ? 'border-brand bg-brand' : 'border-border bg-surface'}`}>
                    <Text
                      className={`text-sm font-bold ${selected ? 'text-on-brand' : 'text-foreground'}`}>
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <Text className="text-sm font-bold text-foreground">Tổng thanh toán</Text>
              <Text className="text-lg font-bold text-primary">{formatExactVnd(total)}</Text>
            </View>
            {starterPriceVnd !== null && total > starterPriceVnd ? (
              <Text
                accessibilityLiveRegion="polite"
                className="rounded-xl border border-warning bg-warning-soft p-3 text-sm text-warning">
                Gói Starter ({formatExactVnd(starterPriceVnd)}) rẻ hơn số lượt bạn đang chọn.
              </Text>
            ) : null}
            <PaymentProviderPicker value={provider} disabled={submitting} onChange={setProvider} />
          </>
        ) : offerError ? (
          <ErrorBlock message={offerError} onRetry={() => void loadOffer()} />
        ) : (
          <LoadingBlock label="Đang tải giá..." />
        )}
        {error ? (
          <PendingOrderNotice message={error} orderId={pendingOrderId} onOpenOrder={onOpenOrder} />
        ) : null}
      </View>
    </ModalShell>
  );
}
