// Web components/membership/MembershipStatusCard (full view). The compact view is
// listing-manage/MembershipCard.
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { Skeleton } from '@/components/rental/shared/StateBlocks';
import {
  formatVndPrice,
  formatVnDateTime,
  getQuotaResetLabel,
  getTierLabel,
  type MembershipPlanInfo,
} from '@/lib/membership';
import type { MembershipAddonOffer, MembershipView } from '@/services/membershipApi';

export default function MembershipStatusCard({
  membership,
  unlimited,
  loading,
  plans,
  addonOffer,
  onBuyAddon,
}: {
  membership: MembershipView | null;
  unlimited: boolean;
  loading: boolean;
  plans: MembershipPlanInfo[] | null;
  addonOffer: MembershipAddonOffer | null;
  onBuyAddon: () => void;
}) {
  if (loading && !membership)
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Đang tải số dư lượt đăng tin"
        className="gap-3 rounded-2xl border border-border bg-surface p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-2/3" />
      </View>
    );

  const tier = unlimited ? 'ADMIN' : (membership?.tier ?? 'FREE');
  const isFree = tier === 'FREE';
  const remaining = membership?.remainingUses ?? 0;
  const reserved = membership?.reservedUses ?? 0;
  const addon = membership?.addonRemaining ?? 0;
  const held = reserved + (membership?.addonReserved ?? 0);
  const quota = plans?.find((plan) => plan.code === tier)?.publicationUses;
  // The server's freeUsed is per FREE period; a paid plan's used count is what is neither left nor held.
  const used = isFree
    ? (membership?.freeUsed ?? 0)
    : Math.max(0, (quota ?? 0) - remaining - reserved);
  const addonExpiry = addon ? formatVnDateTime(membership?.addonExpiresAt) : null;
  const planExpiry = formatVnDateTime(membership?.expiresAt);
  const validity = unlimited
    ? 'Vĩnh viễn (ADMIN)'
    : planExpiry
      ? `Hạn gói: ${planExpiry}`
      : getQuotaResetLabel(membership);

  return (
    <View
      accessibilityLabel="Số dư lượt đăng tin"
      className="rounded-2xl border border-border bg-surface">
      <View className="gap-1 border-b border-border p-4">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          {membership || unlimited ? getTierLabel(tier, plans) : 'Chưa tải được thông tin gói'}
        </Text>
        {validity ? <Text className="text-sm text-muted-foreground">{validity}</Text> : null}
      </View>
      {unlimited ? (
        <Text className="p-4 text-sm leading-5 text-muted-foreground">
          Tài khoản ADMIN được đăng và đăng lại tin không giới hạn số lượt.
        </Text>
      ) : (
        <>
          <View className="gap-1 p-4">
            <Text className="text-sm text-muted-foreground">
              {isFree ? 'Lượt miễn phí còn lại' : 'Lượt gói còn lại'}
            </Text>
            <Text className="text-3xl font-bold text-foreground">
              {membership ? remaining : '—'}
            </Text>
            {membership && quota !== undefined ? (
              <Text className="text-sm text-muted-foreground">
                Đã dùng {used}/{quota} lượt
              </Text>
            ) : null}
          </View>
          <View className="gap-1 border-t border-border p-4">
            <Text className="text-sm text-muted-foreground">Lượt mua thêm</Text>
            <Text className="text-3xl font-bold text-foreground">{membership ? addon : '—'}</Text>
            {addonExpiry ? (
              <Text className="text-sm text-muted-foreground">Hạn gần nhất: {addonExpiry}</Text>
            ) : null}
            {addonOffer ? (
              <Text className="text-sm text-muted-foreground">
                {formatVndPrice(addonOffer.unitPriceVnd)}/lượt, dùng trong {addonOffer.validDays}{' '}
                ngày
              </Text>
            ) : null}
            <ActionButton
              label="Mua thêm lượt"
              variant="secondary"
              className="mt-2"
              onClick={onBuyAddon}
            />
          </View>
          <View className="gap-1 border-t border-border px-4 py-3">
            {held > 0 ? (
              <Text className="text-sm font-semibold text-foreground">
                {held} lượt đang giữ chỗ cho tin chờ duyệt.
              </Text>
            ) : null}
            <Text className="text-sm leading-5 text-muted-foreground">
              Lượt gói được dùng trước; lượt mua thêm giữ nguyên khi đổi gói.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
