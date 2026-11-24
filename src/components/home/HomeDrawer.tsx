import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '@/components/Avatar';
import Ionicons from '@/components/Icon';
import { useDialog } from '@/components/AppDialog';
import { useAuth } from '@/features/auth/AuthProvider';
import { isUnlimitedMembership } from '@/lib/membership';
import type { MembershipView } from '@/services/membershipApi';
import type { UserProfileResponse } from '@/types/api';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TIER_LABEL: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
  ADMIN: 'ADMIN',
};

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

function membershipNote(me: MembershipView | null, unlimited: boolean) {
  if (unlimited) return 'Không giới hạn lượt đăng';
  if (!me) return 'Chưa tải được thông tin gói & lượt đăng';
  const expired = Boolean(me.expiresAt) && new Date(me.expiresAt!).getTime() <= Date.now();
  return `Còn ${me.remainingUses} lượt khả dụng${me.reservedUses > 0 ? ` • ${me.reservedUses} chờ duyệt` : ''}${expired ? ' • Đã hết hạn' : ''}`;
}

/** Mobile counterpart of the web avatar menu, as a bottom sheet. */
export default function HomeDrawer({
  visible,
  onClose,
  profile,
  userName,
  membership,
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

            {/* Info only: the app has no membership screen and no web URL to open. */}
            <View className="my-1 flex-row items-center rounded-xl border border-primary-border bg-primary-soft px-3 py-2.5">
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
                      {unlimited ? 'ADMIN' : (TIER_LABEL[membership!.tier] ?? membership!.tier)}
                    </Text>
                  ) : null}
                </View>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {membershipNote(membership, unlimited)}
                </Text>
              </View>
            </View>
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
