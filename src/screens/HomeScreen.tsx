import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import HomeAiPanel from '@/components/HomeAiPanel';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import FeaturedListings from '@/components/home/FeaturedListings';
import HomeDrawer from '@/components/home/HomeDrawer';
import HomeHeader from '@/components/home/HomeHeader';
import type { City } from '@/components/home/LocationPicker';
import MembershipSection from '@/components/home/MembershipSection';
import PopularAreas from '@/components/home/PopularAreas';
import PriceExplorer from '@/components/home/PriceExplorer';
import { mergeMembershipPlans, type MembershipPlanInfo } from '@/lib/membership';
import { useFavoriteListings } from '@/lib/use-favorite-listings';
import { wardsOfCity } from '@/lib/wards';
import { getPublicListings, type ListingSummary } from '@/services/listingApi';
import { getUserProfileApi } from '@/services/userApi';
import { getMembershipPlans, getMyMembership, type MembershipView } from '@/services/membershipApi';
import type { ManagementSection } from '@/services/managementApi';
import type { UserProfileResponse } from '@/types/api';
import provinces from '@/data/provinces.json';

export default function HomeScreen({
  onSelectTab,
  onOpenListing,
  onBrowse,
  onOpenNews,
  onOpenManagement,
  onOpenFavorites,
  onOpenNotifications,
  onOpenHistory,
}: {
  onSelectTab?: (tab: MainTab) => void;
  onOpenListing?: (id: string) => void;
  onBrowse: (filters: Record<string, string | number>) => void;
  onOpenNews: () => void;
  onOpenManagement: (section: ManagementSection) => void;
  onOpenFavorites: () => void;
  onOpenNotifications: () => void;
  onOpenHistory: () => void;
}) {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [category, setCategory] = useState<string | undefined>();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanInfo[] | null>(null);
  const [membership, setMembership] = useState<MembershipView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);
  const [city, setCity] = useState<City>(
    provinces.find((item) => item.name.includes('Hồ Chí Minh')) || provinces[0]
  );
  const [wardId, setWardId] = useState('');
  const ward = useMemo(
    () => wardsOfCity(city.code).find((item) => item.code === wardId),
    [city.code, wardId]
  );
  const browseFilters: Record<string, string | number> = {
    cityId: city.code,
    ...(wardId ? { wardId } : {}),
    ...(category ? { category } : {}),
  };

  const loadListings = useCallback(
    async (isRefresh = false) => {
      const id = ++requestId.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await getPublicListings({
          page: 1,
          size: 8,
          sort: 'newest',
          cityId: city.code,
          ...(wardId ? { wardId } : {}),
          ...(category ? { category } : {}),
        });
        if (id === requestId.current) setListings(result);
      } catch (loadError) {
        if (id !== requestId.current) return;
        setListings([]);
        setError(loadError instanceof Error ? loadError.message : 'Không tải được tin đăng');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [category, city.code, wardId]
  );

  useEffect(() => {
    loadListings();
    return invalidateRequests;
  }, [loadListings, invalidateRequests]);

  useEffect(() => {
    getUserProfileApi()
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    getMembershipPlans()
      .then((plans) => setMembershipPlans(mergeMembershipPlans(plans)))
      .catch(() => setMembershipPlans(mergeMembershipPlans(null)));
    // A failed lookup just means "no plan info": the cards still render.
    getMyMembership()
      .then(setMembership)
      .catch(() => undefined);
  }, []);

  // One favorite set for the cards and the header heart count.
  const { favoriteIds, toggle: toggleFavoriteListing } = useFavoriteListings();

  const userName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    profile?.username ||
    'HomeSpace';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <HomeHeader
        city={city}
        wardId={wardId}
        locationLabel={ward?.name_with_type ?? city.name}
        onChangeLocation={(nextCity, nextWardId) => {
          setCity(nextCity);
          setWardId(nextWardId);
        }}
        avatarUri={profile?.avatarUrl}
        userName={userName}
        favoriteCount={favoriteIds.size}
        onOpenFavorites={onOpenFavorites}
        onOpenNotifications={onOpenNotifications}
        onOpenMenu={() => setMenuOpen(true)}
      />
      <ProfileCompletionBanner />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadListings(true)} />
        }
        contentContainerClassName="pb-6"
        showsVerticalScrollIndicator={false}>
        <View className="mx-5 mt-4">
          <HomeAiPanel onOpenListing={onOpenListing} />
        </View>

        <FeaturedListings
          areaLabel={ward?.name_with_type ?? city.name}
          wholeCity={!ward}
          category={category}
          onChangeCategory={setCategory}
          listings={listings}
          loading={loading}
          error={error}
          onRetry={() => loadListings()}
          onViewAll={() => onBrowse(browseFilters)}
          onOpenListing={onOpenListing}
          favoriteIds={favoriteIds}
          onToggleFavorite={(id) => void toggleFavoriteListing(id)}
        />

        <PopularAreas
          onSelect={(cityId, nextCategory) => {
            const next = provinces.find((item) => item.code === cityId);
            if (next) {
              setCity(next);
              setWardId('');
            }
            onBrowse({ cityId, category: nextCategory });
          }}
        />

        <PriceExplorer
          cityCode={city.code}
          cityName={city.name}
          onViewPrice={(nextCategory) =>
            onBrowse({
              cityId: city.code,
              ...(wardId ? { wardId } : {}),
              category: nextCategory,
            })
          }
        />

        <MembershipSection
          plans={membershipPlans}
          membership={membership}
          role={profile?.role}
          onPostListing={() => onOpenManagement('landlord-properties')}
        />
      </ScrollView>

      <BottomTabBar active="home" onSelect={(tab) => onSelectTab?.(tab)} />
      <HomeDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        profile={profile}
        userName={userName}
        membership={membership}
        onDashboard={() => onSelectTab?.('management')}
        onFavorites={onOpenFavorites}
        onHistory={onOpenHistory}
        onSettings={() => onSelectTab?.('profile')}
        onRentals={() => onSelectTab?.('search')}
        onNews={onOpenNews}
      />
    </SafeAreaView>
  );
}
