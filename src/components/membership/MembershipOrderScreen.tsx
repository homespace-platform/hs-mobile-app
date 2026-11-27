// Web app/dashboard/membership/return and /eth in one screen, plus the SePay page that the web
// opens in the browser. The status shown always comes from the order API.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import {
  canCancelMembershipOrder,
  formatExactVnd,
  formatVnDateTime,
  getAddonBalanceLabel,
  getCancelOutcomeNotice,
  getMembershipErrorMessage,
  getOrderProductLabel,
  getOrderStatusPresentation,
  getPaymentProviderDisplayName,
  isMembershipChangeSignal,
  isOrderCancelledStatus,
  isOrderFailedStatus,
  isOrderPaidStatus,
  isOrderPendingStatus,
  isOrderReviewStatus,
  MOBILE_ETH_DISABLED_MESSAGE,
  MOBILE_ETH_PAYMENT_ENABLED,
  type MembershipPlanInfo,
} from '@/lib/membership';
import { isSepayPaymentPage } from '@/lib/membership-checkout';
import {
  formatSepoliaEth,
  isTransactionHash,
  type EthSubmission,
} from '@/lib/membership-eth-payment';
import {
  createOrderFeed,
  quoteMembershipEth,
  sendMembershipEth,
  settleMembershipPayment,
  syncOrderMemory,
  type OrderMemory,
} from '@/lib/membership-order';
import { encodeWalletMessage, getSepoliaWallet } from '@/lib/metamask-wallet';
import { subscribeNotificationEvents } from '@/lib/realtime/connections';
import { createRentalRequestSync } from '@/lib/rental/useRentalRequestSync';
import { isAppVisible } from '@/lib/rental-sync/hooks';
import {
  cancelMembershipOrder,
  getMembershipEthChallenge,
  getMembershipEthQuote,
  getMembershipOrder,
  getMyMembership,
  settleMembershipEth,
  type MembershipEthQuote,
  type MembershipOrder,
  type MembershipView,
} from '@/services/membershipApi';

import type { PlacedOrder } from './MembershipScreen';

const MAX_POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2500;
const SETTLE_INTERVAL_MS = 8000;

const TONES = {
  success: {
    text: 'text-success',
    box: 'border-success bg-success-soft',
    icon: 'checkmark-circle',
  },
  danger: { text: 'text-danger', box: 'border-danger bg-danger-soft', icon: 'close-circle' },
  warning: { text: 'text-warning', box: 'border-warning bg-warning-soft', icon: 'time-outline' },
  info: {
    text: 'text-primary',
    box: 'border-primary-border bg-primary-soft',
    icon: 'information-circle',
  },
} as const;

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text selectable className="text-sm font-semibold text-foreground">
        {value}
      </Text>
    </View>
  );
}

export default function MembershipOrderScreen({
  placed,
  memory,
  plans,
  onBack,
  onManageListings,
  onCreateListing,
  onBuyAgain,
}: {
  placed: PlacedOrder;
  memory: OrderMemory;
  plans: MembershipPlanInfo[] | null;
  onBack: () => void;
  onManageListings: () => void;
  onCreateListing: () => void;
  onBuyAgain: (addon: boolean) => void;
}) {
  const { orderId } = placed;
  const showDialog = useDialog();
  const [hosted, setHosted] = useState(placed.hosted ?? null);
  const [order, setOrder] = useState<MembershipOrder | null>(null);
  const [membership, setMembership] = useState<MembershipView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [polling, setPolling] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ReturnType<typeof getCancelOutcomeNotice> | null>(null);
  const [submission, setSubmission] = useState<EthSubmission | null>(null);
  const [quote, setQuote] = useState<MembershipEthQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [ethError, setEthError] = useState<string | null>(null);
  const [recoveryHash, setRecoveryHash] = useState('');
  const [feed] = useState(() => createOrderFeed(() => getMembershipOrder(orderId)));
  const applied = useRef(0);
  const stopPolling = useRef(false);
  const cancelLock = useRef(false);
  const walletLock = useRef(false);
  const settleLock = useRef(false);
  const knownHash = useRef<string | undefined>(undefined);

  const apply = useCallback(
    async (next: MembershipOrder) => {
      if (next.id !== orderId) throw new Error('Không xác nhận được trạng thái đơn hội viên.');
      const wasPaid = isOrderPaidStatus(feed.status());
      if (!feed.accept(next)) return;
      const mine = ++applied.current;
      setOrder(next);
      setLoadError(null);
      try {
        const proof = await syncOrderMemory(memory, next);
        // While MetaMask is open the send flow owns this state.
        if (!walletLock.current && mine === applied.current) {
          knownHash.current = proof?.txHash ?? (proof ? knownHash.current : undefined);
          setSubmission(proof && { ...proof, txHash: knownHash.current });
        }
      } catch (cause) {
        setEthError(getMembershipErrorMessage(cause));
      }
      if (isOrderPaidStatus(next.status) && !wasPaid)
        void getMyMembership()
          .then(setMembership)
          .catch(() => undefined);
    },
    [feed, memory, orderId]
  );

  /** `fresh` asks for a read that starts now, not one already in flight. */
  const refresh = useCallback(
    async (fresh = false) => {
      const next = await (fresh ? feed.readFresh() : feed.read());
      await apply(next);
      return next;
    },
    [apply, feed]
  );

  const loadFailure = useCallback((cause: unknown) => {
    setLoadError(
      getMembershipErrorMessage(
        cause,
        'Không thể truy vấn trạng thái đơn hàng từ máy chủ HomeSpace.'
      )
    );
  }, []);

  useEffect(() => {
    if (hosted) return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    stopPolling.current = false;
    const poll = async () => {
      if (!active || stopPolling.current) return;
      setPollCount(++attempts);
      setPolling(true);
      try {
        await refresh();
        if (
          active &&
          !stopPolling.current &&
          isOrderPendingStatus(feed.status()) &&
          attempts < MAX_POLL_ATTEMPTS
        )
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        else if (active) setPolling(false);
      } catch (cause) {
        if (!active) return;
        setPolling(false);
        loadFailure(cause);
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [hosted, feed, refresh, loadFailure]);

  // Back from MetaMask or a banking app, or told by a notification: read the order again, also
  // while the SePay page is open.
  useEffect(() => {
    const sync = createRentalRequestSync({
      refresh: async () => {
        if (!cancelLock.current && !isOrderReviewStatus(feed.status())) await refresh(true);
      },
      isVisible: isAppVisible,
    });
    const unsubscribe = subscribeNotificationEvents((event, payload) => {
      if (isMembershipChangeSignal(event, payload, orderId)) sync.schedule();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync.schedule();
    });
    return () => {
      unsubscribe();
      appState.remove();
      sync.dispose();
    };
  }, [feed, refresh, orderId]);

  // The bank app can finish the payment while the SePay page never returns: close it then.
  useEffect(() => {
    if (order && !isOrderPendingStatus(order.status)) setHosted(null);
  }, [order]);

  const settle = useCallback(
    async (typedHash?: string) => {
      if (settleLock.current) return;
      settleLock.current = true;
      try {
        const next = await settleMembershipPayment(orderId, {
          memory,
          settle: settleMembershipEth,
          knownHash: typedHash ?? knownHash.current,
        });
        feed.drop();
        await apply(next);
        setEthError(null);
      } catch (cause) {
        setEthError(
          getMembershipErrorMessage(
            cause,
            'Giao dịch đã gửi. Hệ thống đang chờ đủ xác nhận; thử kiểm tra lại sau.'
          )
        );
      } finally {
        settleLock.current = false;
      }
    },
    [apply, feed, memory, orderId]
  );

  // Web ETH page: reconcile at once, then every 8 seconds while the order is pending.
  const autoSettle = !hosted && order?.status === 'PENDING' && Boolean(submission?.txHash);
  useEffect(() => {
    if (!autoSettle) return;
    const run = () => {
      if (isAppVisible()) void settle();
    };
    run();
    const timer = setInterval(run, SETTLE_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void settle();
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, [autoSettle, settle]);

  async function recheck() {
    if (rechecking || cancelLock.current) return;
    setRechecking(true);
    setLoadError(null);
    try {
      await refresh(true);
      if (!isOrderPendingStatus(feed.status())) {
        stopPolling.current = true;
        setPolling(false);
      }
    } catch (cause) {
      loadFailure(cause);
    } finally {
      setRechecking(false);
    }
  }

  async function cancel() {
    if (cancelLock.current) return;
    cancelLock.current = true;
    setCancelling(true);
    setCancelError(null);
    setNotice(null);
    stopPolling.current = true;
    setPolling(false);
    try {
      const next = await cancelMembershipOrder(orderId);
      feed.drop();
      await apply(next);
      setNotice(getCancelOutcomeNotice(next));
    } catch (cause) {
      setCancelError(
        getMembershipErrorMessage(
          cause,
          'Không thể hủy đơn hàng hội viên lúc này. Vui lòng thử lại.'
        )
      );
    } finally {
      cancelLock.current = false;
      setCancelling(false);
    }
  }

  function confirmCancel() {
    const name = getPaymentProviderDisplayName(order?.provider);
    const eth = order?.provider === 'ETH';
    showDialog(
      'Xác nhận hủy đơn hàng hội viên đang chờ?',
      `Thao tác này chỉ hủy đơn hàng trên HomeSpace (chuyển sang trạng thái CANCELLED). ${
        eth
          ? 'Nếu đã lấy báo giá ETH, hệ thống chỉ cho hủy khi báo giá hết hạn và blockchain xác nhận chưa thanh toán.'
          : `Bạn có thể tạo giao dịch mới ngay khi gặp lỗi thanh toán qua ${name}.`
      }\n\nLưu ý quan trọng: Thao tác này không thể hủy hoặc hoàn trả giao dịch thu tiền phía ${name} nếu bạn đã thanh toán. ${
        eth
          ? 'Nếu đã gửi giao dịch qua MetaMask, hãy tiếp tục kiểm tra giao dịch thay vì hủy đơn.'
          : `Nếu ${name} xác nhận trừ tiền thành công muộn sau khi hủy, hệ thống vẫn tự áp dụng khoản thanh toán đó cho tài khoản của bạn.`
      }`,
      [
        { text: 'Giữ lại & Tiếp tục chờ', style: 'cancel' },
        { text: 'Xác nhận hủy đơn HomeSpace', style: 'destructive', onPress: () => void cancel() },
      ],
      'warning'
    );
  }

  async function withWallet(work: () => Promise<unknown>, fallback: string) {
    if (walletLock.current) return;
    walletLock.current = true;
    setBusy(true);
    setEthError(null);
    try {
      await work();
    } catch (cause) {
      setEthError(getMembershipErrorMessage(cause, fallback));
    } finally {
      walletLock.current = false;
      setBusy(false);
    }
  }

  const connectAndQuote = () =>
    withWallet(async () => {
      if (!order) return;
      setQuote(null);
      setQuote(
        await quoteMembershipEth(orderId, order.amountVnd, {
          getWallet: getSepoliaWallet,
          encodeMessage: encodeWalletMessage,
          getChallenge: getMembershipEthChallenge,
          getQuote: getMembershipEthQuote,
        })
      );
    }, 'Không lấy được báo giá ETH.');

  const pay = () =>
    withWallet(async () => {
      if (!quote) return;
      await sendMembershipEth(orderId, quote, {
        memory,
        getOrder: () => refresh(true),
        getWallet: getSepoliaWallet,
        onSubmission: (next) => {
          knownHash.current = next?.txHash;
          setSubmission(next);
          if (next?.txHash) setQuote(null);
        },
      });
    }, 'Không thể gửi giao dịch Sepolia.');

  if (hosted)
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <ScreenHeader title="Thanh toán SePay" onBack={() => setHosted(null)} />
        <WebView
          source={hosted.source}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={({ url, isTopFrame }) => {
            if (isTopFrame !== false && hosted.returnUrls.includes(url)) {
              setHosted(null);
              return false;
            }
            return isSepayPaymentPage(url);
          }}
          onError={() => setHosted(null)}
          onHttpError={() => setHosted(null)}
          allowFileAccess={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          thirdPartyCookiesEnabled={false}
          startInLoadingState
        />
        <View className="border-t border-border bg-surface px-5 py-3">
          <ActionButton label="Kiểm tra trạng thái" onClick={() => setHosted(null)} />
        </View>
      </SafeAreaView>
    );

  const eth = order?.provider === 'ETH';
  const paid = isOrderPaidStatus(order?.status);
  const review = isOrderReviewStatus(order?.status);
  const failed = isOrderFailedStatus(order?.status);
  const pending = isOrderPendingStatus(order?.status);
  const addon = order?.kind === 'ADDON';
  const presentation = getOrderStatusPresentation(order?.status, order?.provider);
  const tone = TONES[presentation.tone];
  const typed = recoveryHash.trim();
  const addonBalance = getAddonBalanceLabel(membership);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader
        title={eth ? 'Thanh toán hội viên bằng ETH' : 'Kết quả thanh toán hội viên'}
        onBack={onBack}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 px-4 py-4">
        {!order ? (
          loadError ? (
            <ErrorBlock
              title="Chưa thể tải thông tin đơn hàng"
              message={loadError}
              retryLabel="Thử kiểm tra lại"
              busy={rechecking}
              onRetry={() => void recheck()}
            />
          ) : (
            <LoadingBlock label={`Đang xác thực đơn hàng #${orderId}...`} />
          )
        ) : (
          <>
            <View
              accessibilityLiveRegion="polite"
              className="items-center gap-2 rounded-2xl border border-border bg-surface p-4">
              <Icon name={tone.icon} size={40} className={tone.text} />
              <Text className={`text-center text-xs font-bold ${tone.text}`}>
                {presentation.label}
              </Text>
              <Text
                accessibilityRole="header"
                className="text-center text-lg font-bold text-foreground">
                {paid
                  ? addon
                    ? 'Mua thêm lượt đăng thành công!'
                    : 'Kích hoạt gói hội viên thành công!'
                  : review
                    ? 'Đơn hàng đang được xử lý'
                    : isOrderCancelledStatus(order.status)
                      ? 'Đơn hàng hội viên đã được hủy'
                      : failed
                        ? 'Giao dịch không thành công'
                        : 'Đang xử lý xác nhận thanh toán...'}
              </Text>
              <Text className="text-center text-sm leading-5 text-muted-foreground">
                {presentation.description}
              </Text>
              {pending && polling ? (
                <Text className="text-xs font-semibold text-primary">
                  Đang tự động kiểm tra với máy chủ (lần {pollCount}/{MAX_POLL_ATTEMPTS})...
                </Text>
              ) : null}
            </View>

            {eth && review ? (
              <Text className="rounded-2xl border border-warning bg-warning-soft p-3 text-sm text-warning">
                Đơn đang được xử lý. Không gửi thêm ETH.
              </Text>
            ) : null}
            {submission && !paid ? (
              <View className="gap-2 rounded-2xl border border-border bg-surface p-4">
                {submission.txHash ? (
                  <>
                    <Detail label="Giao dịch đã gửi:" value={submission.txHash} />
                    <ActionButton
                      label="Xem giao dịch trên Etherscan"
                      variant="secondary"
                      link
                      onClick={() =>
                        void Linking.openURL(`https://sepolia.etherscan.io/tx/${submission.txHash}`)
                      }
                    />
                    {!review ? (
                      <>
                        <Text className="text-sm leading-5 text-muted-foreground">
                          Hệ thống cần ít nhất 3 block xác nhận. Ứng dụng sẽ tự kiểm tra lại;
                          đừng chuyển ETH lần nữa.
                        </Text>
                        <ActionButton label="Đối soát lại" onClick={() => void settle()} />
                      </>
                    ) : null}
                  </>
                ) : !review ? (
                  <>
                    <Text className="text-sm leading-5 text-muted-foreground">
                      {busy
                        ? 'Đang chờ MetaMask trả mã giao dịch. Đừng chuyển ETH lần nữa.'
                        : 'Chưa nhận được mã giao dịch từ MetaMask. Kiểm tra lịch sử ví: nếu đã gửi, dán mã giao dịch vào đây để kiểm tra; đừng chuyển ETH lần nữa. Nếu chưa gửi, có thể hủy đơn sau khi báo giá hết hạn.'}
                    </Text>
                    <Field
                      label="Mã giao dịch Sepolia (0x…)"
                      value={recoveryHash}
                      onChangeText={setRecoveryHash}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <ActionButton
                      label="Đối soát giao dịch"
                      disabled={!isTransactionHash(typed)}
                      onClick={() => void settle(typed)}
                    />
                  </>
                ) : null}
              </View>
            ) : eth && order.status === 'PENDING' && !MOBILE_ETH_PAYMENT_ENABLED ? (
              <View
                accessible
                className="gap-2 rounded-2xl border border-warning bg-warning-soft p-4">
                <Text className="text-sm font-bold text-warning">
                  {MOBILE_ETH_DISABLED_MESSAGE}
                </Text>
                <Text selectable className="text-sm leading-5 text-warning">
                  Đơn này đang chờ thanh toán bằng Sepolia ETH. Đăng nhập HomeSpace trên web và mở
                  /dashboard/membership/eth?orderId={order.id} để tiếp tục, hoặc hủy đơn tại đây.
                  Nếu đã chuyển ETH, không chuyển thêm.
                </Text>
              </View>
            ) : eth && order.status === 'PENDING' ? (
              <View className="gap-2 rounded-2xl border border-border bg-surface p-4">
                <ActionButton
                  label={quote ? 'Lấy lại báo giá' : 'Kết nối MetaMask và lấy báo giá'}
                  variant={quote ? 'secondary' : 'primary'}
                  busy={busy}
                  disabled={cancelling}
                  onClick={() => void connectAndQuote()}
                />
                {quote ? (
                  <>
                    <Detail label="Ví trả:" value={quote.payer} />
                    <Detail label="Ví nền tảng nhận ETH:" value={quote.recipient} />
                    <Detail
                      label="Số ETH:"
                      value={`${formatSepoliaEth(quote.amountWei)} Sepolia ETH + phí gas`}
                    />
                    {quote.ethVnd ? (
                      <Detail
                        label="Tỷ giá tham chiếu:"
                        value={`1 ETH = ${formatExactVnd(quote.ethVnd)}`}
                      />
                    ) : null}
                    <Detail label="Hết hạn:" value={formatVnDateTime(quote.expiresAt) ?? '—'} />
                    <Text className="text-xs text-muted-foreground">
                      Sepolia ETH chỉ dùng để thử nghiệm, không có giá thị trường như ETH Mainnet.
                    </Text>
                    <ActionButton
                      label="Xác nhận giao dịch trong MetaMask"
                      busy={busy}
                      disabled={cancelling}
                      onClick={() => void pay()}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
            <ErrorNotice message={ethError} />

            {notice ? (
              <Text
                accessibilityLiveRegion="polite"
                className={`rounded-2xl border p-3 text-sm leading-5 ${TONES[notice.tone].box} ${TONES[notice.tone].text}`}>
                {notice.message}
              </Text>
            ) : null}

            <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
              <Detail label="Mã đơn hàng (Order ID):" value={order.id} />
              <Detail
                label={addon ? 'Sản phẩm:' : 'Gói đăng ký:'}
                value={getOrderProductLabel(order, plans)}
              />
              <Detail label="Số tiền đơn hàng:" value={formatExactVnd(order.amountVnd)} />
              <Detail
                label="Cổng thanh toán:"
                value={getPaymentProviderDisplayName(order.provider)}
              />
              <Detail label="Trạng thái máy chủ:" value={order.status} />
              {order.createdAt ? (
                <Detail
                  label="Thời gian tạo đơn:"
                  value={formatVnDateTime(order.createdAt) ?? '—'}
                />
              ) : null}
              {order.paidAt ? (
                <Detail
                  label="Thời gian xác nhận thanh toán:"
                  value={formatVnDateTime(order.paidAt) ?? '—'}
                />
              ) : null}
            </View>

            {paid && membership ? (
              <View className="gap-2 rounded-2xl border border-success bg-success-soft p-4">
                <Text className="text-sm font-bold text-success">
                  Hạn mức hội viên hiện tại của bạn:
                </Text>
                <Text className="text-sm text-success">
                  Lượt gói còn lại:{' '}
                  {membership.unlimited
                    ? 'Không giới hạn (ADMIN)'
                    : `${membership.remainingUses} lượt`}
                </Text>
                <Text className="text-sm text-success">
                  Hạn sử dụng gói: {formatVnDateTime(membership.expiresAt) ?? '—'}
                </Text>
                {addonBalance ? (
                  <Text className="text-sm font-semibold text-success">{addonBalance}</Text>
                ) : null}
              </View>
            ) : null}

            <ErrorNotice message={cancelError} />
            <ErrorNotice message={loadError} />
            {pending ? (
              <ActionButton
                label="Kiểm tra lại trạng thái"
                icon="refresh"
                busy={rechecking}
                disabled={cancelling}
                onClick={() => void recheck()}
              />
            ) : null}
            {canCancelMembershipOrder(order) ? (
              <ActionButton
                label={cancelling ? 'Đang hủy đơn hàng...' : 'Hủy đơn hàng'}
                variant="danger"
                busy={cancelling}
                disabled={busy}
                onClick={confirmCancel}
              />
            ) : null}
            {paid ? <ActionButton label="Đăng tin mới ngay" onClick={onCreateListing} /> : null}
            {failed ? (
              <ActionButton
                label={
                  addon
                    ? 'Mua thêm lượt lại'
                    : isOrderCancelledStatus(order.status)
                      ? 'Chọn gói & Tạo đơn thanh toán mới'
                      : 'Chọn lại gói & Thanh toán lại'
                }
                onClick={() => onBuyAgain(addon)}
              />
            ) : null}
          </>
        )}
        <ActionButton label="Quản lý tin đăng" variant="secondary" onClick={onManageListings} />
        <ActionButton label="Bảng gói hội viên" variant="secondary" onClick={onBack} />
        <PolicyNotice
          tone="info"
          title="Xác thực trạng thái đơn hàng từ máy chủ HomeSpace"
          summary="Xác thực trạng thái đơn hàng từ máy chủ HomeSpace"
          text={`Hệ thống không bao giờ xác nhận thanh toán chỉ dựa vào đường dẫn trả về. Trạng thái trên đây được truy vấn trực tiếp từ máy chủ đơn hàng của HomeSpace sau khi kiểm tra kết quả thanh toán với ${getPaymentProviderDisplayName(order?.provider)}.`}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
