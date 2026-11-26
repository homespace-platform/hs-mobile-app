import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import HomeAiPanel from '@/components/HomeAiPanel';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import FeaturedListings from '@/components/home/FeaturedListings';
import HomeLocationFilter from '@/components/home/HomeLocationFilter';
import TabHeader from '@/components/TabHeader';
import type { City } from '@/components/home/LocationPicker';
import MembershipSection from '@/components/home/MembershipSection';
import PopularAreas from '@/components/home/PopularAreas';
import PriceExplorer from '@/components/home/PriceExplorer';
import MyListingsScreen from '@/components/listing-manage/MyListingsScreen';
import MembershipScreen from '@/components/membership/MembershipScreen';
import { useMembershipPricing } from '@/components/membership/useMembershipPricing';
import { useFavoriteListings } from '@/lib/use-favorite-listings';
import { wardsOfCity } from '@/lib/wards';
import { getPublicListings, type ListingSummary } from '@/services/listingApi';
import { getUserProfileApi } from '@/services/userApi';
import type { ManagementSection } from '@/services/managementApi';
import type { UserProfileResponse } from '@/types/api';
import provinces from '@/data/provinces.json';

export default function HomeScreen({
  onSelectTab,
  onOpenListing,
  onBrowse,
  onOpenManagement,
}: {
  onSelectTab?: (tab: MainTab) => void;
  onOpenListing?: (id: string) => void;
  onBrowse: (filters: Record<string, string | number>) => void;
  onOpenManagement: (section: ManagementSection) => void;
}) {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [category, setCategory] = useState<string | undefined>();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  // Open over Home; `tier` starts that plan's checkout, `listings` is its listing list.
  const [membershipView, setMembershipView] = useState<{
    tier?: string;
    listings?: boolean;
  } | null>(null);
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

  const pricing = useMembershipPricing(profile?.role);

  // One favorite set for the cards and the header heart count.
  const { favoriteIds, toggle: toggleFavoriteListing } = useFavoriteListings();

  // Kept inside Home so that Back from the listings returns to the membership screen.
  if (membershipView?.listings)
    return (
      <MyListingsScreen
        onBack={() => setMembershipView({})}
        onSelectTab={(tab) => {
          // Home is already the app's screen: only close what is shown over it.
          if (tab === 'home') setMembershipView(null);
          onSelectTab?.(tab);
        }}
      />
    );

  if (membershipView)
    return (
      <MembershipScreen
        initialTier={membershipView.tier}
        onBack={() => {
          setMembershipView(null);
          void pricing.reload();
        }}
        onManageListings={() => setMembershipView({ listings: true })}
      />
    );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <TabHeader
        profile={profile}
        favoriteCount={favoriteIds.size}
        membership={pricing.membership}
        onOpenMembership={() => setMembershipView({})}>
        <HomeLocationFilter
          city={city}
          wardId={wardId}
          locationLabel={ward?.name_with_type ?? city.name}
          onChangeLocation={(nextCity, nextWardId) => {
            setCity(nextCity);
            setWardId(nextWardId);
          }}
        />
      </TabHeader>
      <ProfileCompletionBanner />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadListings(true);
              void pricing.reload();
              if (!profile)
                void getUserProfileApi()
                  .then(setProfile)
                  .catch(() => undefined);
            }}
          />
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
          plans={pricing.plans}
          error={pricing.plansError}
          cardState={pricing.cardState}
          onRetry={() => void pricing.reload()}
          onPostListing={() => onOpenManagement('landlord-properties')}
          onOpenMembership={(tier) => setMembershipView({ tier })}
        />
      </ScrollView>

      <BottomTabBar active="home" onSelect={(tab) => onSelectTab?.(tab)} />
    </SafeAreaView>
  );
}
