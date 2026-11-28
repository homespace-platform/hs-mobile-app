import { useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import Icon from '@/components/Icon';
import ManagementOverview from '@/components/management/ManagementOverview';
import LandlordAnalytics from '@/components/management/LandlordAnalytics';
import { useDialog } from '@/components/AppDialog';
import { ScreenHeader } from '@/components/Screen';
import TabHeader, { TabHeaderNavigation } from '@/components/TabHeader';
import {
  MANAGEMENT_NAVIGATION,
  MANAGEMENT_TITLES,
  type ManagementDestination,
  type ManagementRole,
} from '@/lib/dashboard-navigation';
import { rentalRouteForDestination, type RentalRoute } from '@/lib/rental-nav/routes';
import { rentalRouteFromActionPath } from '@/lib/rental-nav/deep-link';
import { dashboardWebUrl } from '@/lib/dashboard-summary';
import { webBaseUrl } from '@/config/env';

const ROLE_OPTIONS = [
  { id: 'landlord', label: 'Cho thuê', icon: 'business-outline' },
  { id: 'tenant', label: 'Người thuê', icon: 'key-outline' },
] as const;

export default function ManagementDashboardScreen({
  role,
  onSelectRole,
  onSelectTab,
  onOpenSection,
  onOpenRental,
}: {
  role: ManagementRole;
  onSelectRole: (role: ManagementRole) => void;
  onSelectTab: (tab: MainTab) => void;
  onOpenSection: (
    section:
      | 'tenant-appointments'
      | 'landlord-appointments'
      | 'landlord-properties'
      | 'landlord-membership'
      | 'landlord-branches'
  ) => void;
  onOpenRental: (route: RentalRoute) => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [destination, setDestination] = useState<ManagementDestination | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const drawerWidth = Math.min(width * 0.85, 360);
  const showDialog = useDialog();
  const navigation = useContext(TabHeaderNavigation);

  function openAction(href: string) {
    if (href === '/favorites' && navigation) {
      navigation.onOpenShortcut('favorites');
      return;
    }
    const route = rentalRouteFromActionPath(href, role);
    if (route) {
      onOpenRental(route);
      return;
    }
    const sections: Record<string, Parameters<typeof onOpenSection>[0]> = {
      '/dashboard/properties': 'landlord-properties',
      '/dashboard/branches': 'landlord-branches',
      '/dashboard/membership': 'landlord-membership',
      '/dashboard/viewing-schedules': 'landlord-appointments',
      '/dashboard/viewing-schedules/my-bookings': 'tenant-appointments',
    };
    if (sections[href]) {
      onOpenSection(sections[href]);
      return;
    }
    const url = dashboardWebUrl(webBaseUrl, href);
    if (!url) {
      showDialog('Không mở được mục này', 'Đường dẫn chưa được hỗ trợ.');
      return;
    }
    void Linking.openURL(url).catch(() =>
      showDialog('Không mở được trang', 'Vui lòng thử lại sau.')
    );
  }

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  // Existing native destinations keep their navigation and verified-context data.
  function openDestination(next: ManagementDestination) {
    const rentalRoute = rentalRouteForDestination(next);
    if (rentalRoute) onOpenRental(rentalRoute);
    else if (
      next === 'tenant-appointments' ||
      next === 'landlord-appointments' ||
      next === 'landlord-branches' ||
      next === 'landlord-properties' ||
      next === 'landlord-membership'
    )
      onOpenSection(next);
    else setDestination(next);
  }

  function closeDrawer(next?: ManagementDestination) {
    Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setDrawerOpen(false);
      if (next) openDestination(next);
    });
  }

  return (
    <SafeAreaView
      className={`flex-1 ${destination ? 'bg-surface' : 'bg-background'}`}
      edges={['top', 'bottom']}>
      {destination ? (
        <>
          <ScreenHeader
            title={MANAGEMENT_TITLES[destination]}
            onBack={() => setDestination(null)}
          />
          <ScrollView className="flex-1" contentContainerClassName="px-5 pb-6 pt-5">
            {destination === 'landlord-analytics' ? (
              <LandlordAnalytics onAction={openAction} />
            ) : null}
          </ScrollView>
        </>
      ) : (
        <>
          <TabHeader
            title={role === 'landlord' ? 'Cho Thuê' : 'Người Thuê'}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở menu quản lý"
                accessibilityState={{ expanded: drawerOpen }}
                onPress={() => setDrawerOpen(true)}
                className="h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
                <Icon name="menu" size={24} className="text-foreground" />
              </Pressable>
            }
          />
          <ScrollView className="flex-1" contentContainerClassName="px-5 pb-6 pt-5">
            <ManagementOverview role={role} onOpen={openDestination} onAction={openAction} />
          </ScrollView>
          <BottomTabBar
            active="management"
            onSelect={onSelectTab}
            showManagementAttention={false}
          />
        </>
      )}

      <Modal
        visible={drawerOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onShow={() => {
          Animated.timing(progress, {
            toValue: 1,
            duration: reduceMotion ? 0 : 220,
            useNativeDriver: true,
          }).start();
        }}
        onRequestClose={() => closeDrawer()}>
        <View className="flex-1 flex-row">
          <Animated.View className="absolute inset-0 bg-overlay/60" style={{ opacity: progress }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng menu quản lý"
              className="flex-1"
              onPress={() => closeDrawer()}
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            className="border-r border-border bg-surface"
            style={{
              width: drawerWidth,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-drawerWidth, 0],
                  }),
                },
              ],
            }}>
            <View className="flex-row items-center justify-between border-b border-border px-4 py-2">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                Menu quản lý
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng menu"
                onPress={() => closeDrawer()}
                className="h-12 w-12 items-center justify-center rounded-xl">
                <Icon name="close" size={24} className="text-muted-foreground" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pb-4">
              <Text
                accessibilityRole="header"
                className="mb-2 mt-4 text-xs font-bold uppercase text-muted-foreground">
                Vai trò
              </Text>
              <View className="flex-row gap-1 rounded-2xl border border-border bg-muted p-1">
                {ROLE_OPTIONS.map((option) => {
                  const selected = role === option.id;
                  const textColor = selected ? 'text-on-brand' : 'text-secondary';
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setDestination(null);
                        onSelectRole(option.id);
                      }}
                      className={`min-h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-2 ${selected ? 'bg-brand' : ''}`}>
                      <Icon name={option.icon} size={18} className={textColor} />
                      <Text className={`text-sm font-bold ${textColor}`}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {MANAGEMENT_NAVIGATION[role].map((group) => (
                <View key={group.title} className="mt-5">
                  <Text
                    accessibilityRole="header"
                    className="mb-2 px-2 text-xs font-bold uppercase text-muted-foreground">
                    {group.title}
                  </Text>
                  {group.items.map((item) => {
                    const isDashboard = item.id === 'dashboard';
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isDashboard }}
                        onPress={() => closeDrawer(item.id === 'dashboard' ? undefined : item.id)}
                        className={`min-h-12 flex-row items-center gap-3 rounded-xl px-3 py-2 ${isDashboard ? 'bg-primary-soft' : ''}`}>
                        <Icon
                          name={item.icon}
                          size={20}
                          className={isDashboard ? 'text-primary' : 'text-muted-foreground'}
                        />
                        <Text
                          className={`flex-1 text-sm font-semibold ${isDashboard ? 'text-primary' : 'text-foreground'}`}>
                          {item.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
