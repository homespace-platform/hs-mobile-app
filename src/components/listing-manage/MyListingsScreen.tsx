// Web app/dashboard/properties/page.tsx; the owner view and the editor open over the list.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import Icon from '@/components/Icon';
import MembershipScreen from '@/components/membership/MembershipScreen';
import ActionButton from '@/components/rental/shared/ActionButton';
import { ErrorNotice, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { STATUS_TABS } from '@/lib/listing-manage';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import ListingDetailScreen from '@/screens/ListingDetailScreen';
import ListingDraftScreen from '@/screens/ListingDraftScreen';
import { getMyMembership, type MembershipView } from '@/services/membershipApi';
import { getMyListingCounts, getMyListings, type MyListingSummary } from '@/services/myListingApi';
import { getUserProfileApi } from '@/services/userApi';

import MembershipCard from './MembershipCard';
import MyListingCard from './MyListingCard';
import { useListingNotifications } from './useListingNotifications';

type Overlay =
  | { type: 'detail'; id: string }
  | { type: 'membership'; addon: boolean }
  | { type: 'editor'; listingId?: string; duplicateFromId?: string };

const FIRST_QUERY = { status: 'ALL', keyword: '', page: 1 };

export default function MyListingsScreen({
  onBack,
  onSelectTab,
}: {
  onBack: () => void;
  onSelectTab: (tab: MainTab) => void;
}) {
  const postGate = useFeatureGate(PERMISSIONS.LISTING_POST);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [query, setQuery] = useState(FIRST_QUERY);
  const [keywordInput, setKeywordInput] = useState('');
  const [items, setItems] = useState<MyListingSummary[]>([]);
  const [totals, setTotals] = useState({ pages: 1, elements: 0 });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [membership, setMembership] = useState<MembershipView | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Only the latest request of each kind may update state.
  const listSeq = useRef(0);
  const countsSeq = useRef(0);

  const loadList = useCallback(async () => {
    const seq = ++listSeq.current;
    try {
      const response = await getMyListings({
        page: query.page,
        status: query.status === 'ALL' ? undefined : query.status,
        keyword: query.keyword,
      });
      if (seq !== listSeq.current) return;
      const pages = response.totalPages || 1;
      // The last item of the last page left this filter: step back instead of showing "empty".
      if (!response.result?.length && query.page > pages) {
        setQuery((current) => ({ ...current, page: pages }));
        return;
      }
      setItems(response.result ?? []);
      setTotals({ pages, elements: response.totalElements || 0 });
      setError(null);
      setLoading(false);
    } catch (cause) {
      if (seq !== listSeq.current) return;
      setItems([]);
      setError(apiError(cause));
      setLoading(false);
    }
  }, [query]);

  const loadCounts = useCallback(async () => {
    const seq = ++countsSeq.current;
    try {
      const next = await getMyListingCounts();
      if (seq === countsSeq.current && next) setCounts(next);
    } catch {
      // Tabs keep their last counts, as on web.
    }
  }, []);

  const refreshListings = useCallback(
    () => Promise.all([loadList(), loadCounts()]),
    [loadList, loadCounts]
  );
  // Notifications refresh the list and counts, not the membership.
  useListingNotifications(refreshListings);

  // Manual refresh and every change made from here also re-read the membership.
  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
    return refreshListings();
  }, [refreshListings]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    let active = true;
    setMembershipLoading(true);
    void getMyMembership()
      .then((next) => {
        if (active) setMembership(next);
      })
      // Keep the previous value when the membership service is unavailable.
      .catch(() => undefined)
      .finally(() => {
        if (active) setMembershipLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    void getUserProfileApi()
      .then((profile) => setRole(profile.role ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const keyword = keywordInput.trim();
      setQuery((current) =>
        current.keyword === keyword ? current : { ...current, keyword, page: 1 }
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  function clearSearch() {
    setKeywordInput('');
    setQuery((current) => (current.keyword ? { ...current, keyword: '', page: 1 } : current));
  }

  function goToPage(page: number) {
    setQuery((current) => ({ ...current, page }));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function closeOverlay(changed: boolean) {
    setOverlay(null);
    if (changed) void reload();
  }

  // `=== true`: some buttons call this with their press event.
  const openMembership = (addon?: boolean) =>
    setOverlay({ type: 'membership', addon: addon === true });

  if (overlay?.type === 'membership')
    return (
      <MembershipScreen
        initialAddon={overlay.addon}
        onBack={() => closeOverlay(true)}
        onManageListings={() => closeOverlay(true)}
      />
    );

  if (overlay?.type === 'detail')
    return (
      <ListingDetailScreen
        key={overlay.id}
        listingId={overlay.id}
        own
        onBack={() => closeOverlay(true)}
        onOpenManagement={() => closeOverlay(true)}
        onOpenListing={(id) => setOverlay({ type: 'detail', id })}
        // The owner view has no chat actions.
        onOpenMessages={() => undefined}
        onSelectTab={onSelectTab}
      />
    );

  if (overlay)
    return (
      <ListingDraftScreen
        // "Nhân bản thành tin mới" from a locked listing needs a fresh editor.
        key={`${overlay.listingId}-${overlay.duplicateFromId}`}
        listingId={overlay.listingId}
        duplicateFromId={overlay.duplicateFromId}
        onBack={() => closeOverlay(false)}
        onSaved={() => closeOverlay(true)}
        onViewListing={(id) => setOverlay({ type: 'detail', id })}
        onDuplicate={(id) => setOverlay({ type: 'editor', duplicateFromId: id })}
        onOpenMembership={openMembership}
        onManageListings={() => closeOverlay(true)}
      />
    );

  const filtered = Boolean(query.keyword) || query.status !== 'ALL';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Quản lý tin đăng" onBack={onBack} />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-3 pb-8 pt-2"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void reload().finally(() => setRefreshing(false));
            }}
          />
        }>
        <ActionButton
          label="Đăng tin mới"
          icon="add-circle-outline"
          hint={postGate.title}
          className="mb-2"
          onClick={() => {
            if (postGate.guard()) setOverlay({ type: 'editor' });
          }}
        />
        {postGate.title ? (
          <Text className="mb-2 text-xs text-warning">{postGate.title}</Text>
        ) : null}
        <MembershipCard
          membership={membership}
          role={role}
          loading={membershipLoading}
          onRefresh={() => void reload()}
          onManage={openMembership}
          onBuyAddon={() => openMembership(true)}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2"
          accessibilityRole="tablist">
          {STATUS_TABS.map((tab) => {
            const selected = query.status === tab.value;
            const count =
              tab.value === 'ALL' ? (counts.ALL ?? totals.elements) : (counts[tab.value] ?? 0);
            return (
              <Pressable
                key={tab.value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${tab.label}, ${count} tin`}
                onPress={() =>
                  setQuery((current) =>
                    current.status === tab.value
                      ? current
                      : { ...current, status: tab.value, page: 1 }
                  )
                }
                className={`mr-1.5 min-h-[44px] flex-row items-center gap-1.5 rounded-full border px-3 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                <Text
                  className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-secondary'}`}>
                  {tab.label}
                </Text>
                <Text
                  className={`text-xs font-bold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View className="mb-2 min-h-[44px] flex-row items-center rounded-xl border border-border bg-surface px-3">
          <Icon name="search-outline" size={19} className="text-subtle" />
          <TextInput
            value={keywordInput}
            onChangeText={setKeywordInput}
            placeholder="Tìm kiếm tin đăng..."
            returnKeyType="search"
            accessibilityLabel="Tìm kiếm tin đăng"
            className="ml-2 min-h-[44px] flex-1 py-1 text-sm text-foreground placeholder:text-subtle"
          />
          {keywordInput ? (
            <Pressable
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel="Xóa nội dung tìm kiếm"
              className="min-h-[44px] min-w-[44px] items-center justify-center">
              <Icon name="close-circle" size={19} className="text-subtle" />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <>
            <ErrorNotice message={error} />
            <ActionButton
              label="Thử lại"
              icon="refresh"
              onClick={() => {
                setLoading(true);
                setError(null);
                void reload();
              }}
            />
          </>
        ) : loading ? (
          <ActivityIndicator accessibilityLabel="Đang tải tin đăng" className="my-8 text-primary" />
        ) : !items.length ? (
          <View className="items-center gap-2 py-10">
            <Icon name="business-outline" size={32} className="text-primary" />
            <Text className="text-center text-base font-bold text-foreground">
              {filtered ? 'Không tìm thấy tin đăng phù hợp' : 'Chưa có tin đăng nào'}
            </Text>
            <Text className="text-center text-xs leading-5 text-muted-foreground">
              {filtered
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn bộ lọc trạng thái để xem các tin khác.'
                : 'Bạn chưa tạo tin cho thuê nào. Hãy bắt đầu đăng tin ngay để tiếp cận hàng ngàn khách thuê tiềm năng!'}
            </Text>
            {filtered ? (
              <ActionButton
                label="Xóa bộ lọc"
                variant="secondary"
                onClick={() => {
                  setKeywordInput('');
                  setQuery(FIRST_QUERY);
                }}
              />
            ) : null}
          </View>
        ) : (
          <>
            {items.map((item) => (
              <MyListingCard
                key={item.id}
                item={item}
                onView={() => setOverlay({ type: 'detail', id: item.id })}
                onEdit={() => setOverlay({ type: 'editor', listingId: item.id })}
                onDuplicate={() => setOverlay({ type: 'editor', duplicateFromId: item.id })}
                onChanged={() => void reload()}
                onOpenMembership={openMembership}
              />
            ))}
            {totals.pages > 1 ? (
              <View className="gap-2 border-t border-border pt-3">
                <Text className="text-center text-xs text-muted-foreground">
                  Trang {query.page} / {totals.pages} (Tổng cộng {totals.elements} tin đăng)
                </Text>
                <View className="flex-row gap-2">
                  <ActionButton
                    label="Trang trước"
                    icon="chevron-back"
                    variant="secondary"
                    disabled={query.page <= 1}
                    className="flex-1"
                    onClick={() => goToPage(query.page - 1)}
                  />
                  <ActionButton
                    label="Trang sau"
                    icon="chevron-forward"
                    variant="secondary"
                    disabled={query.page >= totals.pages}
                    className="flex-1"
                    onClick={() => goToPage(query.page + 1)}
                  />
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <BottomTabBar active="management" onSelect={onSelectTab} attentionVersion={reloadKey} />
    </SafeAreaView>
  );
}
