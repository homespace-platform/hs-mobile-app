// Web components/membership/MembershipCheckoutModal.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import ActionButton from '@/components/rental/shared/ActionButton';
import ModalShell from '@/components/rental/shared/ModalShell';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import {
  formatExactVnd,
  formatVnDateTime,
  getMembershipErrorMessage,
  getQuotaResetLabel,
  getTierLabel,
  type MembershipPlanInfo,
} from '@/lib/membership';
import { isMembershipQuote } from '@/lib/membership-checkout';
import {
  placeMembershipOrder,
  type OrderMemory,
  type PlaceOrderResult,
} from '@/lib/membership-order';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import {
  cancelMembershipOrder,
  createMembershipCheckout,
  getMembershipQuote,
  type MembershipPaymentMethod,
  type MembershipQuote,
  type MembershipView,
  type PaidMembershipTier,
} from '@/services/membershipApi';

import PaymentProviderPicker from './PaymentProviderPicker';
import PendingOrderNotice from './PendingOrderNotice';

function Row({
  label,
  value,
  strong,
  struck,
}: {
  label: string;
  value: string;
  strong?: boolean;
  struck?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text
        className={
          strong
            ? 'text-lg font-bold text-primary'
            : struck
              ? 'text-sm text-muted-foreground line-through'
              : 'shrink text-sm font-semibold text-foreground'
        }>
        {value}
      </Text>
    </View>
  );
}

export default function MembershipCheckoutModal({
  plan,
  tier,
  plans,
  membership,
  memory,
  onClose,
  onPlaced,
  onOpenOrder,
}: {
  plan: MembershipPlanInfo;
  tier: PaidMembershipTier;
  plans: MembershipPlanInfo[] | null;
  membership: MembershipView | null;
  memory: OrderMemory;
  onClose: () => void;
  onPlaced: (order: Extract<PlaceOrderResult, { kind: 'ok' }>) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const showDialog = useDialog();
  const gate = useFeatureGate(PERMISSIONS.MEMBERSHIP_PURCHASE);
  const [quote, setQuote] = useState<MembershipQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [provider, setProvider] = useState<MembershipPaymentMethod>('SEPAY');
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  const loadQuote = useCallback(async () => {
    setLoadingQuote(true);
    setQuoteError(null);
    try {
      const next = await getMembershipQuote(tier);
      if (!isMembershipQuote(next, tier)) throw new Error('Báo giá hội viên không hợp lệ.');
      setQuote(next);
    } catch (cause) {
      setQuote(null);
      setQuoteError(
        getMembershipErrorMessage(
          cause,
          'Không thể lấy báo giá từ máy chủ. Vui lòng thử lại để xem số tiền chính xác.'
        )
      );
    } finally {
      setLoadingQuote(false);
    }
  }, [tier]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  async function confirm(repeat?: boolean) {
    if (!quote || lock.current || !gate.guard()) return;
    lock.current = true;
    setSubmitting(true);
    setError(null);
    setPendingOrderId(null);
    const result = await placeMembershipOrder({
      create: (confirmRepeat) => createMembershipCheckout(tier, provider, confirmRepeat),
      cancel: cancelMembershipOrder,
      memory,
      provider,
      confirmRepeat: repeat === true,
      expectedAmount: quote.amountVnd,
    });
    lock.current = false;
    if (result.kind === 'ok') return onPlaced(result);
    setSubmitting(false);
    if (result.kind === 'repeat-paid')
      return showDialog(
        'Xác nhận mua thêm',
        result.message,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Vẫn mua thêm', onPress: () => void confirm(true) },
        ],
        'warning'
      );
    if (result.kind === 'price-changed') {
      // The server re-quoted under its lock: show the new quote before asking again.
      await loadQuote();
      if (!result.pendingOrderId)
        return showDialog('Số tiền đã thay đổi', result.message, undefined, 'warning');
    }
    setError(result.message);
    setPendingOrderId(result.pendingOrderId);
  }

  const upgrade = Boolean(quote?.upgrade || quote?.mode === 'UPGRADE');
  const replaced =
    !upgrade && membership && !membership.unlimited && membership.tier !== 'FREE'
      ? membership.remainingUses
      : 0;
  const saved = upgrade && quote ? Math.max(0, plan.priceVnd - quote.amountVnd) : 0;
  const reset = getQuotaResetLabel(membership);
  const gateway = provider === 'ETH' ? 'MetaMask' : 'SePay';

  return (
    <ModalShell
      title={
        membership?.tier === tier
          ? `Mua lại ${plan.shortName}`
          : upgrade
            ? `Nâng cấp lên ${plan.name}`
            : `Đăng ký ${plan.name}`
      }
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <View className="w-full gap-2">
          {gate.title ? <Text className="text-xs text-warning">{gate.title}</Text> : null}
          <ActionButton
            label={
              submitting
                ? provider === 'ETH'
                  ? 'Đang tạo đơn Sepolia...'
                  : 'Đang chuyển tới SePay...'
                : quote
                  ? `Thanh toán ${formatExactVnd(quote.amountVnd)} qua ${gateway}`
                  : `Thanh toán qua ${gateway}`
            }
            busy={submitting}
            disabled={loadingQuote || !quote || !gate.allowed}
            hint={gate.title}
            onClick={() => void confirm()}
          />
          <ActionButton label="Hủy" variant="secondary" disabled={submitting} onClick={onClose} />
        </View>
      }>
      <View className="gap-3">
        <Text className="text-xs font-bold uppercase text-primary">Xác nhận đơn hàng hội viên</Text>
        {loadingQuote ? (
          <LoadingBlock label="Đang lấy báo giá chính xác từ máy chủ HomeSpace..." />
        ) : quoteError ? (
          <ErrorBlock
            title="Không thể tải báo giá từ máy chủ"
            message={quoteError}
            onRetry={() => void loadQuote()}
          />
        ) : quote ? (
          <>
            {upgrade ? (
              <View className="gap-1 rounded-2xl border border-success bg-success-soft p-3">
                <Text className="text-sm font-bold text-success">
                  Áp dụng ưu đãi nâng cấp trong 24 giờ đầu tiên
                </Text>
                <Text className="text-sm leading-5 text-success">
                  Bạn chỉ cần thanh toán phần chênh lệch giá so với gói đã mua. Lượt được tính lại
                  từ đầu theo định mức gói {plan.shortName} ({plan.publicationUses} lượt). Tin đang
                  chờ duyệt vẫn giữ lượt.
                </Text>
                {quote.upgradeDeadline ? (
                  <Text className="text-xs font-semibold text-success">
                    Thời hạn ưu đãi nâng cấp 24h: tới {formatVnDateTime(quote.upgradeDeadline)}
                  </Text>
                ) : null}
              </View>
            ) : replaced > 0 ? (
              <View
                accessibilityRole="alert"
                accessible
                className="gap-1 rounded-2xl border border-warning bg-warning-soft p-3">
                <Text className="text-sm font-bold text-warning">
                  Cảnh báo thay thế gói — Không cộng dồn lượt cũ
                </Text>
                <Text className="text-sm leading-5 text-warning">
                  Giao dịch này áp dụng <Text className="font-bold">nguyên giá gói</Text> (ngoài
                  khung nâng cấp 24h đầu tiên hoặc mua mới). Khi gói {plan.shortName} kích hoạt, gói
                  hiện tại ({getTierLabel(membership?.tier, plans)}) sẽ kết thúc và{' '}
                  <Text className="font-bold">
                    {replaced} lượt chưa sử dụng của gói cũ sẽ chấm dứt
                  </Text>{' '}
                  (các gói thay thế nhau, không cộng dồn).
                </Text>
              </View>
            ) : null}
            <View className="gap-2 rounded-2xl border border-border bg-surface p-3">
              <Row
                label="Gói hiện tại:"
                value={`${getTierLabel(membership?.tier, plans)} (Còn ${membership?.remainingUses ?? 0} lượt)`}
              />
              {membership?.addonRemaining ? (
                <Text className="text-xs text-muted-foreground">
                  {membership.addonRemaining} lượt mua thêm được giữ nguyên khi đổi gói.
                </Text>
              ) : null}
              {reset ? <Text className="text-xs text-muted-foreground">{reset}</Text> : null}
              <Row label="Gói đăng ký mới:" value={plan.name} />
              <Row
                label="Giá niêm yết của gói:"
                value={formatExactVnd(plan.priceVnd)}
                struck={saved > 0}
              />
              {saved > 0 ? (
                <Row label="Khấu trừ gói cũ (trong 24h đầu):" value={`-${formatExactVnd(saved)}`} />
              ) : null}
              <View className="border-t border-border pt-2">
                <Row
                  label="Số tiền thanh toán (Server báo giá):"
                  value={formatExactVnd(quote.amountVnd)}
                  strong
                />
              </View>
            </View>
            <View className="gap-1 rounded-2xl border border-border bg-surface p-3">
              <Text className="text-xs font-semibold text-muted-foreground">
                Số lượt khả dụng sau thanh toán
              </Text>
              <Text className="text-base font-bold text-foreground">
                {quote.remainingUsesAfter} lượt đăng tin
              </Text>
              <Text className="text-xs text-muted-foreground">
                {quote.remainingUsesAfter < plan.publicationUses
                  ? `Gói ${plan.publicationUses} lượt, đang giữ ${plan.publicationUses - quote.remainingUsesAfter} lượt cho tin chờ duyệt`
                  : `Thay thế bằng toàn bộ ${quote.remainingUsesAfter} lượt của gói mới`}
              </Text>
              <Text className="mt-2 text-xs font-semibold text-muted-foreground">
                Thời hạn gói sau kích hoạt
              </Text>
              <Text className="text-sm font-bold text-foreground">
                {formatVnDateTime(quote.expiresAtAfter) ??
                  `${plan.durationDays} ngày kể từ lúc kích hoạt`}
              </Text>
              <Text className="text-xs text-muted-foreground">Chu kỳ {plan.durationDays} ngày</Text>
            </View>
            <PaymentProviderPicker value={provider} disabled={submitting} onChange={setProvider} />
            <Text className="text-xs leading-5 text-muted-foreground">
              Số tiền thanh toán được xác định trực tiếp bởi máy chủ HomeSpace.{' '}
              {provider === 'ETH'
                ? 'Bạn sẽ ký xác thực ví rồi xác nhận giao dịch Sepolia trong MetaMask. Gói chỉ kích hoạt sau khi máy chủ xác nhận giao dịch blockchain.'
                : 'Ứng dụng sẽ gửi biểu mẫu thanh toán an toàn (POST) sang cổng SePay và kết quả đơn hàng được xác thực từ máy chủ sau khi hoàn tất.'}
            </Text>
            {error ? (
              <PendingOrderNotice
                message={error}
                orderId={pendingOrderId}
                onOpenOrder={onOpenOrder}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </ModalShell>
  );
}
