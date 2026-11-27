// Web /dashboard/membership (MembershipPricingWorkspace). The one place the app buys a plan or
// extra uses; every other entry point opens this screen.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDialog } from '@/components/AppDialog';
import ActionButton from '@/components/rental/shared/ActionButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { ScreenHeader } from '@/components/Screen';
import { gatewayBaseUrl } from '@/config/env';
import { apiError } from '@/lib/api-error';
import {
  isPaidMembershipTier,
  MOBILE_ETH_PAYMENT_ENABLED,
  type MembershipPlanInfo,
} from '@/lib/membership';
import { createOrderMemory, type OrderMemory, type PlaceOrderResult } from '@/lib/membership-order';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { getMembershipAddonOffer, type MembershipAddonOffer } from '@/services/membershipApi';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';

import MembershipAddonModal from './MembershipAddonModal';
import MembershipCheckoutModal from './MembershipCheckoutModal';
import MembershipOrderScreen from './MembershipOrderScreen';
import MembershipPlanCard from './MembershipPlanCard';
import MembershipRules from './MembershipRules';
import MembershipStatusCard from './MembershipStatusCard';
import { useMembershipPricing } from './useMembershipPricing';

export type PlacedOrder = {
  orderId: string;
  /** SePay form to open now; absent for Sepolia and for an order opened again. */
  hosted?: Extract<PlaceOrderResult, { kind: 'ok' }>['hosted'];
};

const secureStore = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};

export default function MembershipScreen({
  onBack,
  onManageListings,
  initialAddon = false,
  initialTier,
  initialOrderId,
  onCreateListing,
}: {
  onBack: () => void;
  onManageListings: () => void;
  /** Open the extra-use purchase at once (web `?addon=1`). */
  initialAddon?: boolean;
  /** Open this plan's checkout once it is known to be allowed (web `?tier=`). */
  initialTier?: string;
  /** Open this order at once (web `/return?orderId=`). */
  initialOrderId?: string;
  /** Replaces "Đăng tin mới ngay" when the caller already holds a listing form. */
  onCreateListing?: () => void;
}) {
  const showDialog = useDialog();
  const postGate = useFeatureGate(PERMISSIONS.LISTING_POST);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [memory, setMemory] = useState<OrderMemory | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [offer, setOffer] = useState<MembershipAddonOffer | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<MembershipPlanInfo | null>(null);
  const [addonOpen, setAddonOpen] = useState(initialAddon);
  const [order, setOrder] = useState<PlacedOrder | null>(
    initialOrderId ? { orderId: initialOrderId } : null
  );
  const [creating, setCreating] = useState(false);
  const autoOpened = useRef(false);
  const { plans, plansError, membership, unlimited, loading, reload, cardState } =
    useMembershipPricing(profile?.role);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    try {
      setProfile(await getUserProfileApi());
    } catch (cause) {
      setProfileError(apiError(cause));
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const userId = profile?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${gatewayBaseUrl}\n${userId}`
    ).then((scope) => {
      if (active) setMemory(createOrderMemory(secureStore, `homespace.membership.${scope}`));
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const loadPending = useCallback(() => {
    // SecureStore is unavailable on Expo web, where nothing can be bought anyway.
    void memory
      ?.pending()
      .then(setPendingOrderId)
      .catch(() => undefined);
  }, [memory]);

  useEffect(loadPending, [loadPending]);

  // Price line only: if this fails the buy button stays and the modal reports the error.
  const loadOffer = useCallback(() => {
    void getMembershipAddonOffer().then(setOffer, () => setOffer(null));
  }, []);

  useEffect(loadOffer, [loadOffer]);

  function refresh() {
    void reload();
    loadOffer();
    loadPending();
    if (!profile) void loadProfile();
  }

  const canPay = useCallback(() => {
    if (Platform.OS === 'web') {
      showDialog('Thanh toán hội viên', 'Mở ứng dụng HomeSpace trên điện thoại để thanh toán.');
      return false;
    }
    if (!memory) {
      showDialog('Chưa tải được tài khoản', 'Hãy bấm "Làm mới" rồi thử thanh toán lại.');
      return false;
    }
    return true;
  }, [memory, showDialog]);

  useEffect(() => {
    if (autoOpened.current || !initialTier || loading || !memory) return;
    const plan = plans?.find((item) => item.code === initialTier);
    if (!plan) return;
    autoOpened.current = true;
    if (cardState(plan).kind === 'buy' && canPay()) setCheckoutPlan(plan);
  }, [canPay, cardState, initialTier, loading, memory, plans]);

  function openOrder(next: PlacedOrder) {
    setCheckoutPlan(null);
    setAddonOpen(false);
    setOrder(next);
  }

  function closeOrder() {
    setOrder(null);
    refresh();
  }

  if (creating) {
    // Required here because the editor imports this screen: a static import would be a cycle.
    const { default: ListingDraftScreen } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/screens/ListingDraftScreen') as typeof import('@/screens/ListingDraftScreen');
    return (
      <ListingDraftScreen
        onBack={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          refresh();
        }}
        onOpenMembership={(addon) => {
          setCreating(false);
          refresh();
          setAddonOpen(addon === true);
        }}
        onManageListings={() => {
          setCreating(false);
          onManageListings();
        }}
      />
    );
  }

  if (order && memory)
    return (
      <MembershipOrderScreen
        key={order.orderId}
        placed={order}
        memory={memory}
        plans={plans}
        onBack={closeOrder}
        onManageListings={onManageListings}
        onCreateListing={() => {
          if (!postGate.guard()) return;
          closeOrder();
          if (onCreateListing) onCreateListing();
          else setCreating(true);
        }}
        onBuyAgain={(addon) => {
          closeOrder();
          if (addon) setAddonOpen(true);
        }}
      />
    );

  const paidDays = plans?.find((plan) => plan.priceVnd > 0)?.durationDays;
  const checkoutTier = checkoutPlan?.code;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Gói hội viên & Lượt đăng tin" onBack={onBack} />
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-8 pt-4"
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        <Text className="text-sm leading-5 text-muted-foreground">
          Chọn gói theo quy mô cho thuê. Lưu nháp và chỉnh sửa luôn miễn phí; thanh toán qua SePay
          {MOBILE_ETH_PAYMENT_ENABLED ? ' hoặc Sepolia ETH' : ''}.
        </Text>
        <View className="flex-row gap-2">
          <ActionButton
            label="Quản lý tin đăng"
            variant="secondary"
            className="flex-1"
            onClick={onManageListings}
          />
          <ActionButton
            label="Làm mới"
            variant="secondary"
            className="flex-1"
            busy={loading}
            onClick={refresh}
          />
        </View>
        {profileError ? (
          <ErrorBlock
            title="Chưa tải được tài khoản"
            message={profileError}
            onRetry={() => void loadProfile()}
          />
        ) : null}
        {pendingOrderId ? (
          <View className="gap-2 rounded-2xl border border-warning bg-warning-soft p-4">
            <Text className="text-sm font-bold text-warning">
              Bạn đang có đơn chờ thanh toán – tiếp tục thanh toán đơn này.
            </Text>
            <ActionButton
              label={`Tiếp tục thanh toán đơn (#${pendingOrderId.slice(0, 8)}...)`}
              variant="secondary"
              onClick={() => setOrder({ orderId: pendingOrderId })}
            />
          </View>
        ) : null}
        <MembershipStatusCard
          membership={membership}
          unlimited={unlimited}
          loading={loading}
          plans={plans}
          addonOffer={unlimited ? null : offer}
          onBuyAddon={() => {
            if (canPay()) setAddonOpen(true);
          }}
        />
        {plansError ? <ErrorBlock message={plansError} onRetry={refresh} busy={loading} /> : null}
        <View className="gap-1">
          <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
            Bảng gói lượt đăng tin
          </Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            Mọi gói: lưu nháp và chỉnh sửa miễn phí; tin đã duyệt hiển thị đủ hạn riêng. Gói trả phí
            {paidDays ? ` có hạn ${paidDays} ngày và` : ''} thay thế nhau, không cộng dồn lượt gói
            cũ. Giá bằng VNĐ, đã gồm thuế theo quy định.
          </Text>
        </View>
        {plans?.length ? (
          plans.map((plan) => (
            <MembershipPlanCard
              key={plan.code}
              plan={plan}
              state={cardState(plan)}
              requested={plan.code === initialTier}
              onSelect={(selected) => {
                if (canPay()) setCheckoutPlan(selected);
              }}
            />
          ))
        ) : loading ? (
          <LoadingBlock label="Đang tải bảng giá..." />
        ) : !plansError ? (
          <EmptyBlock title="Chưa có gói hội viên nào" />
        ) : null}
        <MembershipRules freePlan={plans?.find((plan) => plan.code === 'FREE')} />
      </ScrollView>
      {checkoutPlan && memory && isPaidMembershipTier(checkoutTier) ? (
        <MembershipCheckoutModal
          plan={checkoutPlan}
          tier={checkoutTier}
          plans={plans}
          membership={membership}
          memory={memory}
          onClose={() => {
            setCheckoutPlan(null);
            loadPending();
          }}
          onPlaced={openOrder}
          onOpenOrder={(orderId) => openOrder({ orderId })}
        />
      ) : null}
      {addonOpen && memory && !unlimited && Platform.OS !== 'web' ? (
        <MembershipAddonModal
          starterPriceVnd={plans?.find((plan) => plan.code === 'STARTER')?.priceVnd ?? null}
          memory={memory}
          onClose={() => {
            setAddonOpen(false);
            loadPending();
          }}
          onPlaced={openOrder}
          onOpenOrder={(orderId) => openOrder({ orderId })}
        />
      ) : null}
    </SafeAreaView>
  );
}
