import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useDialog } from '@/components/AppDialog';
import { Button, ErrorNotice, ScreenHeader } from '@/components/Screen';
import { gatewayBaseUrl } from '@/config/env';
import { apiError } from '@/lib/api-error';
import { formatVndPrice } from '@/lib/membership';
import {
  buildSandboxCheckout,
  isMembershipOrderId,
  isMembershipQuote,
  isSandboxPaymentPage,
} from '@/lib/membership-checkout';
import {
  cancelMembershipOrder,
  createMembershipCheckout,
  getMembershipOrder,
  getMembershipQuote,
  type MembershipOrder,
  type MembershipQuote,
  type PaidMembershipTier,
} from '@/services/membershipApi';

const ORDER_STATUS: Record<MembershipOrder['status'], string> = {
  PENDING: 'Đang chờ xác nhận thanh toán từ SePay.',
  PAID: 'Thanh toán thành công. Gói hội viên đã được kích hoạt.',
  FAILED: 'Thanh toán thất bại.',
  EXPIRED: 'Đơn đã hết hạn.',
  CANCELLED: 'Đơn đã được hủy.',
  REVIEW: 'Giao dịch đang được đối soát. Vui lòng kiểm tra lại sau.',
};

export default function MembershipCheckout({ tier, userId, onClose, onPaid }: {
  tier: PaidMembershipTier;
  userId: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const showDialog = useDialog();
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [quote, setQuote] = useState<MembershipQuote | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<MembershipOrder['status'] | null>(null);
  const [hosted, setHosted] = useState<ReturnType<typeof buildSandboxCheckout> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);

  const run = useCallback(async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);

  const loadQuote = useCallback(async () => {
    setQuote(null);
    const result = await getMembershipQuote(tier);
    if (!isMembershipQuote(result, tier)) throw new Error('Báo giá hội viên không hợp lệ.');
    setQuote(result);
  }, [tier]);

  const acceptOrder = useCallback(async (result: MembershipOrder, id: string, key: string) => {
    if (result?.id !== id || !Object.prototype.hasOwnProperty.call(ORDER_STATUS, result.status)) {
      throw new Error('Không xác nhận được trạng thái đơn hội viên.');
    }
    setStatus(result.status);
    if (result.status === 'PAID') onPaid();
    if (result.status !== 'PENDING' && result.status !== 'REVIEW') {
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
    }
  }, [onPaid]);

  useEffect(() => {
    void run(async () => {
      const scope = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${gatewayBaseUrl}\n${userId}`
      );
      const key = `homespace.membership.${scope}`;
      const pending = await SecureStore.getItemAsync(key);
      setStorageKey(key);
      if (isMembershipOrderId(pending)) {
        setOrderId(pending);
        await acceptOrder(await getMembershipOrder(pending), pending, key);
      } else {
        await loadQuote();
      }
    });
  }, [acceptOrder, loadQuote, run, userId]);

  function startCheckout() {
    if (!quote || !storageKey || orderId) return;
    void run(async () => {
      const result = await createMembershipCheckout(tier);
      const id = result?.orderId;
      if (!isMembershipOrderId(id)) throw new Error('Máy chủ không trả về mã đơn hợp lệ.');
      setOrderId(id);
      setStatus('PENDING');

      try {
        await SecureStore.setItemAsync(storageKey, id);
        setHosted(buildSandboxCheckout(result, quote.amountVnd));
      } catch (cause) {
        // SePay has not received this order, so it is safe to cancel it here.
        const cancelled = await cancelMembershipOrder(id);
        await acceptOrder(cancelled, id, storageKey);
        if (cancelled.status === 'CANCELLED') {
          setOrderId(null);
          setStatus(null);
          setQuote(null);
        }
        throw cause;
      }
    });
  }

  function checkOrder() {
    if (!orderId || !storageKey) return;
    setHosted(null);
    void run(async () => {
      await acceptOrder(await getMembershipOrder(orderId), orderId, storageKey);
    });
  }

  function confirmCancel() {
    if (!orderId || !storageKey || status !== 'PENDING') return;
    showDialog('Hủy đơn hội viên?', 'Chỉ hủy nếu bạn chưa thanh toán đơn này.', [
      { text: 'Quay lại', style: 'cancel' },
      { text: 'Hủy đơn', style: 'destructive', onPress: () => void run(async () => {
        await acceptOrder(await cancelMembershipOrder(orderId), orderId, storageKey);
      }) },
    ]);
  }

  function back() {
    if (working.current) return;
    if (hosted) checkOrder();
    else onClose();
  }

  return (
    <Modal animationType="slide" onRequestClose={back}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <ScreenHeader title={hosted ? 'SePay Sandbox' : 'Thanh toán hội viên'} onBack={back} />
        {hosted ? (
          <>
            <WebView
              source={hosted.source}
              originWhitelist={['*']}
              onShouldStartLoadWithRequest={({ url, isTopFrame }) => {
                if (isTopFrame !== false && hosted.returnUrls.includes(url)) {
                  checkOrder();
                  return false;
                }
                return isSandboxPaymentPage(url);
              }}
              onError={checkOrder}
              onHttpError={checkOrder}
              allowFileAccess={false}
              mixedContentMode="never"
              setSupportMultipleWindows={false}
              thirdPartyCookiesEnabled={false}
              startInLoadingState
            />
            <View className="border-t border-border bg-surface px-5 pb-3">
              <Button label="Kiểm tra trạng thái" onPress={checkOrder} />
            </View>
          </>
        ) : (
          <ScrollView contentContainerClassName="px-5 py-5">
            {orderId ? (
              <View className="rounded-2xl border border-border bg-surface p-4">
                <Text className="text-base font-bold text-foreground">
                  {status ? ORDER_STATUS[status] : 'Đang tra cứu đơn hội viên…'}
                </Text>
                <Text selectable className="mt-2 text-xs text-muted-foreground">Mã đơn {orderId}</Text>
                {status === 'PENDING' ? (
                  <Text className="mt-2 text-sm text-muted-foreground">
                    Nếu đã thanh toán, hãy đợi backend xác nhận rồi kiểm tra lại.
                  </Text>
                ) : null}
              </View>
            ) : quote ? (
              <View className="rounded-2xl border border-border bg-surface p-4">
                <Text className="text-base font-bold text-foreground">Gói {tier}</Text>
                <Text className="mt-2 text-sm text-muted-foreground">Số tiền theo báo giá</Text>
                <Text className="text-2xl font-bold text-foreground">{formatVndPrice(quote.amountVnd)}</Text>
                <Text className="mt-2 text-sm text-muted-foreground">
                  {quote.remainingUsesAfter} lượt đăng sau khi kích hoạt
                </Text>
              </View>
            ) : null}
            <ErrorNotice message={error} />
            {!orderId && quote ? (
              <Button label="Xác nhận thanh toán thử qua SePay" onPress={startCheckout} busy={busy} />
            ) : busy ? (
              <ActivityIndicator className="mt-4 text-primary" />
            ) : orderId && (!status || status === 'PENDING' || status === 'REVIEW') ? (
              <>
                <Button label="Kiểm tra trạng thái" onPress={checkOrder} />
                {status === 'PENDING' ? <Button label="Hủy đơn" onPress={confirmCancel} danger /> : null}
              </>
            ) : orderId || !storageKey ? (
              <Button label="Về trang chủ" onPress={onClose} />
            ) : (
              <Button label="Tải lại báo giá" onPress={() => void run(loadQuote)} />
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
