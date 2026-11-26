import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '@/components/Avatar';
import Ionicons from '@/components/Icon';
import { useDialog } from '@/components/AppDialog';
import { useAuth } from '@/features/auth/AuthProvider';
import { getAddonBalanceLabel, getTierShortLabel, isUnlimitedMembership } from '@/lib/membership';
import type { MembershipView } from '@/services/membershipApi';
import type { UserProfileResponse } from '@/types/api';

type IconName = ComponentProps<typeof Ionicons>['name'];

function Item({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-12 flex-row items-center rounded-xl px-3">
      <Ionicons
        name={icon}
        size={20}
        className={danger ? 'text-danger' : 'text-muted-foreground'}
      />
      <Text
        className={`ml-3 flex-1 text-sm font-semibold ${danger ? 'text-danger' : 'text-foreground'}`}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} className="text-subtle" />
    </Pressable>
  );
}

const Divider = () => <View className="my-2 border-t border-border" />;

function Heading({ children }: { children: ReactNode }) {
  return (
    <Text className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </Text>
  );
}

/** Web UserDropdown summary line. */
function membershipNote(me: MembershipView | null, unlimited: boolean) {
  if (unlimited) return 'Không giới hạn lượt đăng (∞)';
  if (!me) return 'Tạm thời chưa tải được hạn mức • Xem chi tiết';
  const held = me.reservedUses + (me.addonReserved ?? 0);
  return `Lượt gói còn: ${me.remainingUses}${held > 0 ? ` • ${held} chờ duyệt` : ''}`;
}

/** Mobile counterpart of the web avatar menu, as a bottom sheet. */
export default function HomeDrawer({
  visible,
  onClose,
  profile,
  userName,
  membership,
  onMembership,
  onDashboard,
  onFavorites,
  onHistory,
  onSettings,
  onRentals,
  onNews,
}: {
  visible: boolean;
  onClose: () => void;
  profile: UserProfileResponse | null;
  userName: string;
  membership: MembershipView | null;
  onMembership: () => void;
  onDashboard: () => void;
  onFavorites: () => void;
  onHistory: () => void;
  onSettings: () => void;
  onRentals: () => void;
  onNews: () => void;
}) {
  const insets = useSafeAreaInsets();
  const showDialog = useDialog();
  const { logout } = useAuth();
  const unlimited = isUnlimitedMembership(membership, profile?.role);
  const addonBalance = getAddonBalanceLabel(membership);
  const go = (action: () => void) => () => {
    onClose();
    action();
  };
  const confirmLogout = () => {
    onClose();
    // Wait for this modal to close before the dialog modal opens.
    setTimeout(
      () =>
        showDialog('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi HomeSpace?', [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng xuất', style: 'destructive', onPress: () => void logout() },
        ]),
      300
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-overlay/65">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng menu tài khoản"
          className="absolute inset-0"
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel="Menu tài khoản"
          className="max-h-[88%] rounded-t-3xl bg-surface px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View className="flex-row items-center px-3 pb-3">
              <Avatar uri={profile?.avatarUrl} name={userName} size={48} />
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                  {userName}
                </Text>
                {profile?.username ? (
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    @{profile.username}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                className="h-11 w-11 items-center justify-center">
                <Ionicons name="close" size={22} className="text-secondary" />
              </Pressable>
            </View>
            <Divider />

            <Item icon="grid-outline" label="Bảng điều khiển" onPress={go(onDashboard)} />

            <Pressable
              onPress={go(onMembership)}
              accessibilityRole="button"
              className="my-1 min-h-12 flex-row items-center rounded-xl border border-primary-border bg-primary-soft px-3 py-2.5 active:opacity-80">
              <Ionicons
                name={unlimited ? 'infinite' : 'ribbon-outline'}
                size={20}
                className="text-primary"
              />
              <View className="ml-3 flex-1">
                <View className="flex-row flex-wrap items-center gap-x-2">
                  <Text className="text-sm font-semibold text-foreground">
                    Gói hội viên & Lượt đăng
                  </Text>
                  {unlimited || membership ? (
                    <Text className="text-xs font-extrabold text-primary">
                      {unlimited ? 'ADMIN' : getTierShortLabel(membership!.tier)}
                    </Text>
                  ) : null}
                </View>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {membershipNote(membership, unlimited)}
                </Text>
                {!unlimited && addonBalance ? (
                  <Text className="mt-0.5 text-xs text-muted-foreground">{addonBalance}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} className="text-primary" />
            </Pressable>
            <Divider />

            <Heading>Tiện ích</Heading>
            <Item icon="heart-outline" label="Tin đã lưu" onPress={go(onFavorites)} />
            <Item icon="time-outline" label="Lịch sử xem tin" onPress={go(onHistory)} />
            <Item icon="settings-outline" label="Cài đặt" onPress={go(onSettings)} />
            <Item icon="log-out-outline" label="Đăng xuất" danger onPress={confirmLogout} />
            <Divider />

            <Item icon="home-outline" label="Nhà Cho Thuê" onPress={go(onRentals)} />
            <Item icon="newspaper-outline" label="Tin Tức" onPress={go(onNews)} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
