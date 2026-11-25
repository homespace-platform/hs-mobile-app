import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useDialog } from '@/components/AppDialog';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
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
  assertPayableEthOrder,
  buildMembershipEthTransaction,
  formatSepoliaEth,
  isTransactionHash,
  isWalletSignature,
  readEthSubmission,
  type EthSubmission,
} from '@/lib/membership-eth-payment';
import { encodeWalletMessage, getSepoliaWallet } from '@/lib/metamask-wallet';
import {
  cancelMembershipOrder,
  createMembershipCheckout,
  getMembershipEthChallenge,
  getMembershipEthQuote,
  getMembershipOrder,
  getMembershipQuote,
  settleMembershipEth,
  type MembershipEthQuote,
  type MembershipOrder,
  type MembershipPaymentMethod,
  type MembershipQuote,
  type PaidMembershipTier,
} from '@/services/membershipApi';

const ETH_PAYMENT_ENABLED = false;

const ORDER_STATUS: Record<MembershipOrder['status'], string> = {
  PENDING: 'Đang chờ xác nhận thanh toán.',
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
  const [method, setMethod] = useState<MembershipPaymentMethod>('SEPAY');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<MembershipOrder['status'] | null>(null);
  const [hosted, setHosted] = useState<ReturnType<typeof buildSandboxCheckout> | null>(null);
  const [ethOrderAmount, setEthOrderAmount] = useState<number | null>(null);
  const [ethQuote, setEthQuote] = useState<MembershipEthQuote | null>(null);
  const [submission, setSubmission] = useState<EthSubmission | null>(null);
  const [recoveryHash, setRecoveryHash] = useState('');
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
    if (result.status === 'PAID') {
      onPaid();
      if (result.provider === 'ETH') {
        await SecureStore.deleteItemAsync(`${key}.${id}`).catch(() => undefined);
      }
    }
    if (result.status === 'PAID' || (result.provider !== 'ETH' && result.status !== 'PENDING' && result.status !== 'REVIEW')) {
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
        const order = await getMembershipOrder(pending);
        await acceptOrder(order, pending, key);
        if (order.provider === 'ETH' && order.status !== 'PAID' && order.status !== 'REVIEW') {
          const saved = readEthSubmission(await SecureStore.getItemAsync(`${key}.${pending}`));
          if (order.status === 'PENDING' || saved) {
            setSubmission(saved);
            setEthOrderAmount(order.amountVnd);
          } else {
            await SecureStore.deleteItemAsync(key);
          }
        }
      } else {
        await loadQuote();
      }
    });
  }, [acceptOrder, loadQuote, run, userId]);

  function startCheckout() {
    if (!quote || !storageKey || orderId || (method === 'ETH' && !ETH_PAYMENT_ENABLED)) return;
    void run(async () => {
      const result = await createMembershipCheckout(tier, method);
      const id = result?.orderId;
      if (!isMembershipOrderId(id)) throw new Error('Máy chủ không trả về mã đơn hợp lệ.');
      setOrderId(id);
      setStatus('PENDING');

      try {
        await SecureStore.setItemAsync(storageKey, id);
        if (method === 'ETH') {
          assertPayableEthOrder({ id, provider: result.provider, amountVnd: result.amountVnd, status: 'PENDING' }, id, quote.amountVnd);
          setEthOrderAmount(result.amountVnd);
        } else {
          setHosted(buildSandboxCheckout(result, quote.amountVnd));
        }
      } catch (cause) {
        // The order has not reached the payment provider or the wallet.
        const cancelled = await cancelMembershipOrder(id);
        await acceptOrder(cancelled, id, storageKey);
        if (cancelled.status === 'CANCELLED') {
          if (cancelled.provider === 'ETH') await SecureStore.deleteItemAsync(storageKey);
          setOrderId(null);
          setStatus(null);
          setQuote(null);
        }
        throw cause;
      }
    });
  }

  function connectAndQuoteEth() {
    if (!ETH_PAYMENT_ENABLED || !orderId || status !== 'PENDING' || ethOrderAmount === null || submission) return;
    void run(async () => {
      setEthQuote(null);
      const { provider, account } = await getSepoliaWallet(true);
      const challenge = await getMembershipEthChallenge(orderId, account);
      if (!challenge?.challengeId || typeof challenge.message !== 'string' ||
          !challenge.message.startsWith(`HomeSpace Sepolia membership wallet ownership\nOrder: ${orderId}\n`) ||
          !challenge.message.includes(`\nWallet: ${account}\n`)) {
        throw new Error('Thông điệp xác thực ví không khớp đơn hội viên hiện tại.');
      }
      const signature = await provider.request({ method: 'personal_sign', params: [encodeWalletMessage(challenge.message), account] });
      if (!isWalletSignature(signature)) throw new Error('MetaMask chưa trả về chữ ký hợp lệ.');
      const result = await getMembershipEthQuote(orderId, challenge.challengeId, signature);
      buildMembershipEthTransaction(result, account, ethOrderAmount);
      setEthQuote(result);
    });
  }

  function sendEth() {
    if (!ETH_PAYMENT_ENABLED || !orderId || !storageKey || status !== 'PENDING' || ethOrderAmount === null || !ethQuote || submission) return;
    void run(async () => {
      const order = await getMembershipOrder(orderId);
      await acceptOrder(order, orderId, storageKey);
      assertPayableEthOrder(order, orderId, ethOrderAmount);
      const { provider, account } = await getSepoliaWallet(false);
      const transaction = buildMembershipEthTransaction(ethQuote, account, ethOrderAmount);
      const draft = { paymentId: ethQuote.paymentId };
      const proofKey = `${storageKey}.${orderId}`;
      await SecureStore.setItemAsync(proofKey, JSON.stringify(draft));
      setSubmission(draft);

      let hash: unknown;
      try {
        hash = await provider.request({ method: 'eth_sendTransaction', params: [transaction] });
      } catch (cause) {
        if ((cause as { code?: number } | null)?.code === 4001) {
          await SecureStore.deleteItemAsync(proofKey);
          setSubmission(null);
        }
        throw cause;
      }
      if (!isTransactionHash(hash)) throw new Error('MetaMask chưa trả mã giao dịch. Hãy kiểm tra lịch sử ví.');

      const record = { ...draft, txHash: hash };
      setSubmission(record);
      await SecureStore.setItemAsync(proofKey, JSON.stringify(record));
      await acceptOrder(await settleMembershipEth(orderId, record.paymentId, hash), orderId, storageKey);
    });
  }

  function settleEth() {
    if (!orderId || !storageKey || !submission) return;
    const txHash = submission.txHash ?? recoveryHash.trim();
    if (!isTransactionHash(txHash)) return;
    void run(async () => {
      await acceptOrder(await settleMembershipEth(orderId, submission.paymentId, txHash), orderId, storageKey);
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
    if (!orderId || !storageKey || status !== 'PENDING' || submission?.txHash) return;
    showDialog('Hủy đơn hội viên?', 'Chỉ hủy nếu bạn chưa thanh toán đơn này.', [
      { text: 'Quay lại', style: 'cancel' },
      { text: 'Hủy đơn', style: 'destructive', onPress: () => void run(async () => {
        const order = await cancelMembershipOrder(orderId);
        await acceptOrder(order, orderId, storageKey);
        if (order.provider === 'ETH' && order.status === 'CANCELLED') {
          await SecureStore.deleteItemAsync(`${storageKey}.${orderId}`);
          await SecureStore.deleteItemAsync(storageKey);
          setSubmission(null);
        }
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
                {status === 'PENDING' && ethOrderAmount === null ? (
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
              <>
                <Text className="mb-2 mt-4 text-sm font-bold text-foreground">Phương thức thanh toán thử</Text>
                <View className="flex-row gap-2" accessibilityRole="radiogroup">
                  {(['SEPAY', 'ETH'] as const).map((option) => {
                    const unavailable = option === 'ETH' && !ETH_PAYMENT_ENABLED;
                    const selected = method === option && !unavailable;
                    const disabled = busy || unavailable;
                    return (
                      <Pressable
                        key={option}
                        disabled={disabled}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled }}
                        onPress={() => setMethod(option)}
                        className={`min-h-12 flex-1 items-center justify-center rounded-xl border px-2 py-2 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                        <Text className={`text-center text-sm font-bold ${unavailable ? 'text-muted-foreground' : selected ? 'text-primary' : 'text-foreground'}`}>
                          {option === 'ETH' ? 'Sepolia ETH' : 'SePay Sandbox'}
                        </Text>
                        {unavailable ? <Text className="text-xs text-muted-foreground">Tạm tắt</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
                <Button label={method === 'ETH' ? 'Tạo đơn Sepolia ETH' : 'Xác nhận thanh toán thử qua SePay'} onPress={startCheckout} busy={busy} />
              </>
            ) : busy ? (
              <ActivityIndicator className="mt-4 text-primary" />
            ) : ethOrderAmount !== null && submission && status !== 'PAID' && status !== 'REVIEW' ? (
              <>
                <Text className="mt-4 text-sm text-muted-foreground">
                  Kiểm tra giao dịch Sepolia trong MetaMask. Chỉ gửi mã giao dịch để đối soát.
                </Text>
                {submission.txHash ? (
                  <Text selectable className="mt-2 text-xs text-foreground">{submission.txHash}</Text>
                ) : (
                  <Field label="Mã giao dịch Sepolia (0x…)" value={recoveryHash} onChangeText={setRecoveryHash} autoCapitalize="none" autoCorrect={false} />
                )}
                <Button label="Đối soát giao dịch" onPress={settleEth} disabled={!isTransactionHash(submission.txHash ?? recoveryHash.trim())} />
                {status === 'PENDING' && !submission.txHash ? <Button label="Hủy đơn" onPress={confirmCancel} danger /> : null}
              </>
            ) : orderId && (!status || status === 'PENDING' || status === 'REVIEW') ? (
              <>
                {status === 'PENDING' && ethOrderAmount !== null && !ETH_PAYMENT_ENABLED ? (
                  <Text className="mt-4 text-sm text-muted-foreground">Thanh toán Sepolia ETH đang tạm tắt.</Text>
                ) : null}
                {status === 'PENDING' && ethOrderAmount !== null && ETH_PAYMENT_ENABLED ? (
                  ethQuote ? (
                    <>
                      <Text className="mt-4 text-lg font-bold text-foreground">{formatSepoliaEth(ethQuote.amountWei)} Sepolia ETH</Text>
                      <Text className="mt-2 text-xs text-muted-foreground">Ví {ethQuote.payer}</Text>
                      <Button label="Xác nhận trong MetaMask" onPress={sendEth} />
                      <Button label="Lấy lại báo giá ETH" onPress={connectAndQuoteEth} />
                    </>
                  ) : (
                    <Button label="Kết nối MetaMask và lấy báo giá ETH" onPress={connectAndQuoteEth} />
                  )
                ) : null}
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
