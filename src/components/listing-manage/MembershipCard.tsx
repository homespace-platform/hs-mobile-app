// Compact variant of web MembershipStatusCard.
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { PolicyDialog } from '@/components/rental/shared/PolicyNotice';
import {
  formatVnDateTime,
  getAddonBalanceLabel,
  getPublishableUses,
  getQuotaResetLabel,
  getTierShortLabel,
  isUnlimitedMembership,
} from '@/lib/membership';
import { splitSentences } from '@/lib/rental/split-sentences';
import type { MembershipView } from '@/services/membershipApi';

export default function MembershipCard({
  membership,
  role,
  loading,
  onRefresh,
  onManage,
  onBuyAddon,
}: {
  membership: MembershipView | null;
  role?: string | null;
  loading: boolean;
  onRefresh: () => void;
  onManage: () => void;
  /** Shown once no use is left. */
  onBuyAddon?: () => void;
}) {
  const [policyOpen, setPolicyOpen] = useState(false);
  const unlimited = isUnlimitedMembership(membership, role);
  const known = unlimited || Boolean(membership);
  const uses = getPublishableUses(membership);
  const held = (membership?.reservedUses ?? 0) + (membership?.addonReserved ?? 0);
  const addon = unlimited ? null : getAddonBalanceLabel(membership);
  const planExpiry = unlimited ? null : formatVnDateTime(membership?.expiresAt);
  const reset = unlimited ? null : getQuotaResetLabel(membership);
  const low = known && !unlimited && uses <= 1;
  const policy = unlimited
    ? 'Tài khoản Quản trị viên có hạn mức đăng tin không giới hạn để kiểm thử và vận hành. Lưu nháp và chỉnh sửa luôn miễn phí.'
    : 'Lưu tin nháp và chỉnh sửa nội dung miễn phí. Tạo mới gửi duyệt hoặc đăng lại tin cần 1 lượt. Tin đã hiển thị vẫn giữ nguyên tới hết hạn riêng của bài đăng ngay cả khi gói hết hạn.';
  return (
    <View
      className={`mb-2 rounded-2xl border px-3 py-0.5 ${low ? 'border-warning bg-warning-soft' : 'border-border bg-surface'}`}>
      <View className="flex-row flex-wrap items-center justify-end gap-x-2">
        <View className="grow flex-row items-center gap-1.5">
          <Icon
            name={unlimited ? 'infinite' : 'ribbon-outline'}
            size={18}
            className="text-primary"
          />
          <Text className="shrink text-sm font-bold text-foreground">
            {known
              ? `Gói hội viên: ${getTierShortLabel(unlimited ? 'ADMIN' : membership?.tier)}`
              : loading
                ? 'Đang tải gói hội viên...'
                : 'Chưa tải được thông tin gói'}
          </Text>
        </View>
        <View className="max-w-full flex-row items-center gap-2">
          <Pressable
            onPress={onManage}
            accessibilityRole="button"
            accessibilityHint="Mở trang Gói hội viên & Lượt đăng tin"
            className="min-h-[44px] shrink flex-row items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 active:opacity-80">
            <Icon name="sparkles-outline" size={14} className="text-primary" />
            <Text className="shrink text-xs font-bold text-foreground">
              {unlimited ? 'Xem bảng gói hội viên' : 'Mua / Nâng cấp gói'}
            </Text>
          </Pressable>
          {loading ? (
            <ActivityIndicator className="h-[44px] w-[44px] text-primary" />
          ) : (
            <Pressable
              onPress={onRefresh}
              accessibilityRole="button"
              accessibilityLabel="Cập nhật hạn mức"
              className="h-[44px] w-[44px] items-center justify-center rounded-lg active:bg-muted">
              <Icon name="refresh" size={18} className="text-muted-foreground" />
            </Pressable>
          )}
        </View>
      </View>
      {known ? (
        <>
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
            {unlimited ? (
              <Text className="text-xs font-semibold text-primary">
                Không giới hạn lượt (Chế độ ADMIN / Kiểm thử)
              </Text>
            ) : (
              <Text className="text-xs font-bold text-foreground">
                Lượt gói còn: {membership?.remainingUses ?? 0}
              </Text>
            )}
            {addon ? <Text className="text-xs font-semibold text-foreground">{addon}</Text> : null}
            {held > 0 ? (
              <Text className="text-xs text-secondary">Đang giữ chỗ chờ duyệt: {held} lượt</Text>
            ) : null}
            {planExpiry ? (
              <Text className="text-xs text-secondary">Hạn gói: {planExpiry}</Text>
            ) : null}
            {reset ? <Text className="text-xs text-secondary">{reset}</Text> : null}
          </View>
          {!unlimited && uses === 0 && onBuyAddon ? (
            <Pressable
              onPress={onBuyAddon}
              accessibilityRole="button"
              className="mt-1 min-h-[44px] items-center justify-center rounded-lg border border-primary bg-surface px-3 active:opacity-80">
              <Text className="text-xs font-bold text-primary">Mua thêm lượt</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setPolicyOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Xem nội dung đầy đủ: Hạn mức đăng tin"
            accessibilityHint="Mở cửa sổ xem nội dung"
            className="min-h-[44px] flex-row items-center gap-1.5 active:opacity-80">
            <Icon name="book-outline" size={16} className="text-muted-foreground" />
            <Text className="flex-1 text-xs text-muted-foreground">
              {splitSentences(policy)[0]}
            </Text>
          </Pressable>
          <PolicyDialog
            visible={policyOpen}
            onClose={() => setPolicyOpen(false)}
            title="Hạn mức đăng tin"
            icon="information-circle-outline"
            text={policy}
          />
        </>
      ) : null}
    </View>
  );
}
