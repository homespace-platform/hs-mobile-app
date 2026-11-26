import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Avatar from '@/components/Avatar';
import type { MainTab } from '@/components/BottomTabBar';
import Icon from '@/components/Icon';
import HomeDrawer from '@/components/home/HomeDrawer';
import { refreshNotificationUnread } from '@/lib/unread-sync';
import { useUnreadNotificationCount } from '@/lib/use-unread';
import { getFavoriteIds } from '@/services/favoriteApi';
import { getMyMembership, type MembershipView } from '@/services/membershipApi';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';

export type HeaderShortcut = 'favorites' | 'notifications' | 'history' | 'news' | 'membership';
export const TabHeaderNavigation = createContext<{
  onSelectTab: (tab: MainTab) => void;
  onOpenShortcut: (shortcut: HeaderShortcut) => void;
} | null>(null);

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-danger-solid px-0.5">
      <Text allowFontScaling={false} className="text-[9px] font-bold text-on-danger-solid">
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabHeader({
  title,
  right,
  children,
  profile,
  favoriteCount,
  membership,
  onOpenMembership,
}: {
  title?: string;
  right?: ReactNode;
  children?: ReactNode;
  profile?: UserProfileResponse | null;
  favoriteCount?: number;
  membership?: MembershipView | null;
  onOpenMembership?: () => void;
}) {
  const navigation = useContext(TabHeaderNavigation);
  const [loadedProfile, setLoadedProfile] = useState<UserProfileResponse | null>(null);
  const [loadedFavoriteCount, setLoadedFavoriteCount] = useState(0);
  const [loadedMembership, setLoadedMembership] = useState<MembershipView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadCount = useUnreadNotificationCount();
  const savedCount = favoriteCount ?? loadedFavoriteCount;
  const hasUnread = unreadCount > 0;
  const hasFavorites = savedCount > 0;
  const account = profile === undefined ? loadedProfile : profile;
  const loadProfile = profile === undefined;
  const loadFavorites = favoriteCount === undefined;
  const userName =
    [account?.firstName, account?.lastName].filter(Boolean).join(' ') ||
    account?.username ||
    'HomeSpace';

  useEffect(() => {
    let active = true;
    if (loadProfile) {
      void getUserProfileApi()
        .then((value) => {
          if (active) setLoadedProfile(value);
        })
        .catch(() => undefined);
    }
    if (loadFavorites) {
      void getFavoriteIds()
        .then((ids) => {
          if (active) setLoadedFavoriteCount(ids.length);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [loadProfile, loadFavorites]);
  useEffect(() => {
    void refreshNotificationUnread(30_000);
  }, []);
  useEffect(() => {
    if (!menuOpen || membership !== undefined) return;
    let active = true;
    void getMyMembership()
      .then((value) => {
        if (active) setLoadedMembership(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [menuOpen, membership]);

  return (
    <View className="border-b border-border bg-surface px-5 pb-4 pt-2">
      <View className="flex-row items-center justify-between gap-2">
        <Image
          source={require('../../assets/homespace-horizontal-logo.png')}
          resizeMode="contain"
          accessibilityLabel="HomeSpace"
          className="h-10 w-36 shrink"
        />
        {navigation ? (
          <View className="shrink-0 flex-row items-center gap-2">
            <Pressable
              onPress={() => navigation.onOpenShortcut('favorites')}
              accessibilityRole="button"
              accessibilityLabel={
                hasFavorites ? 'Tin đã yêu thích, ' + savedCount + ' tin' : 'Tin đã yêu thích'
              }
              className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
              <Icon name="heart-outline" size={20} className="text-secondary" />
              <CountBadge count={savedCount} />
            </Pressable>
            <Pressable
              onPress={() => navigation.onOpenShortcut('notifications')}
              accessibilityRole="button"
              accessibilityLabel={
                hasUnread ? 'Thông báo, ' + unreadCount + ' tin chưa đọc' : 'Thông báo'
              }
              className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
              <Icon name="notifications-outline" size={20} className="text-secondary" />
              <CountBadge count={unreadCount} />
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Mở menu tài khoản"
              className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-primary-border bg-brand">
              <Avatar uri={account?.avatarUrl} name={userName} size={40} />
            </Pressable>
          </View>
        ) : null}
      </View>
      {title || right ? (
        <View className="mt-2 min-h-8 flex-row items-center justify-between">
          {title ? (
            <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {children}
      {navigation ? (
        <HomeDrawer
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          profile={account}
          userName={userName}
          membership={membership === undefined ? loadedMembership : membership}
          onMembership={onOpenMembership ?? (() => navigation.onOpenShortcut('membership'))}
          onDashboard={() => navigation.onSelectTab('management')}
          onFavorites={() => navigation.onOpenShortcut('favorites')}
          onHistory={() => navigation.onOpenShortcut('history')}
          onSettings={() => navigation.onSelectTab('profile')}
          onRentals={() => navigation.onSelectTab('search')}
          onNews={() => navigation.onOpenShortcut('news')}
        />
      ) : null}
    </View>
  );
}
