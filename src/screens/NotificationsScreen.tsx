import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDialog } from '@/components/AppDialog';
import Ionicons from '@/components/Icon';
import NotificationCard from '@/components/notification/NotificationCard';
import { ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { parseDeepLink } from '@/lib/appointment';
import {
  FEED_DEFAULT_LIMIT,
  getNotificationTag,
  isNotificationUnread,
  isVisibleNotification,
  NOTIFICATION_FILTER_TABS,
  notificationTarget,
  type NotificationFilterCategory,
  type NotificationItem,
} from '@/lib/notification';
import { applyNotificationEvent } from '@/lib/realtime/pure';
import { subscribeNotificationEvents } from '@/lib/realtime/connections';
import { notificationUnreadStore } from '@/lib/unread-store';
import { useUnreadNotificationCount } from '@/lib/use-unread';
import type { ManagementSection } from '@/services/managementApi';
import {
  getNotificationFeed,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationApi';

const SIDE_LABELS = { tenant: 'Mở mục người thuê', landlord: 'Mở mục chủ nhà' } as const;

export default function NotificationsScreen({
  onBack,
  onOpenListing,
  onOpenManagement,
  onOpenNews,
}: {
  onBack: () => void;
  onOpenListing: (id: string, own?: boolean) => void;
  onOpenManagement: (section: ManagementSection, appointmentId?: string) => void;
  onOpenNews: () => void;
}) {
  const showDialog = useDialog();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const unreadCount = useUnreadNotificationCount();
  const [tab, setTab] = useState<NotificationFilterCategory>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  // Drops responses of a superseded filter/refresh so an old page never overwrites a newer one.
  const requestId = useRef(0);
  const lastLoadAt = useRef(0);

  const query = useCallback(
    (next?: string | null) => ({
      limit: FEED_DEFAULT_LIMIT,
      cursor: next,
      category: tab === 'ALL' ? undefined : tab,
      unreadOnly,
    }),
    [tab, unreadOnly]
  );

  const load = useCallback(
    async (pullToRefresh = false) => {
      const id = ++requestId.current;
      lastLoadAt.current = Date.now();
      if (pullToRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setMoreError(null);
      try {
        const [page, count] = await Promise.all([
          getNotificationFeed(query()),
          getUnreadNotificationCount().catch(() => null),
        ]);
        if (id !== requestId.current) return;
        setItems(page.items.filter(isVisibleNotification));
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        if (count !== null) notificationUnreadStore.dispatch({ type: 'set', count });
      } catch (loadError) {
        if (id !== requestId.current) return;
        setItems([]);
        setCursor(null);
        setHasMore(false);
        setError(apiError(loadError) || 'Không thể tải danh sách thông báo.');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [query]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: socket events edit the loaded list in place; reconnect/foreground/push reload it
  // (unless it was just loaded). Filters are applied the same way as the server feed.
  useEffect(
    () =>
      subscribeNotificationEvents((event, payload) => {
        if (event === 'connect' || event === 'notifications:changed') {
          if (Date.now() - lastLoadAt.current > 2000) void load(true);
        } else {
          setItems((prev) => applyNotificationEvent(prev, event, payload, { tab, unreadOnly }));
        }
      }),
    [load, tab, unreadOnly]
  );

  const loadMore = async () => {
    if (!hasMore || !cursor || loadingMore || loading) return;
    const id = requestId.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await getNotificationFeed(query(cursor));
      if (id !== requestId.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [
          ...prev,
          ...page.items.filter((item) => isVisibleNotification(item) && !seen.has(item.id)),
        ];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadError) {
      if (id === requestId.current)
        setMoreError(apiError(loadError) || 'Không thể tải thêm thông báo.');
    } finally {
      setLoadingMore(false);
    }
  };

  // Client-side search over the loaded items, like the web page.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.title} ${item.body} ${getNotificationTag(item)}`.toLowerCase().includes(q)
    );
  }, [items, search]);

  const markAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) =>
        unreadOnly ? [] : prev.map((n) => (n.readAt ? n : { ...n, readAt: now }))
      );
      notificationUnreadStore.dispatch({ type: 'reset' });
    } catch (markError) {
      showDialog('Không thể đánh dấu đã đọc', apiError(markError));
    } finally {
      setMarkingAll(false);
    }
  };

  const open = async (item: NotificationItem) => {
    if (isNotificationUnread(item)) {
      try {
        const updated = await markNotificationRead(item.id);
        const readAt = updated?.readAt ?? new Date().toISOString();
        setItems((prev) =>
          unreadOnly
            ? prev.filter((n) => n.id !== item.id)
            : prev.map((n) => (n.id === item.id ? { ...n, readAt } : n))
        );
        notificationUnreadStore.dispatch({ type: 'decrement' });
      } catch {
        // Like the web page: a failed mark-as-read must not block opening the notification.
      }
    }
    const target = notificationTarget(item.actionPath);
    if (target.kind === 'listing') onOpenListing(target.id, target.own);
    else if (target.kind === 'management')
      onOpenManagement(target.section, parseDeepLink(target.query ?? '')?.id);
    else if (target.kind === 'news') onOpenNews();
    else if (target.kind === 'management-choice')
      showDialog(item.title, `${item.body}\n\nBạn đang xem với vai trò nào?`, [
        { text: SIDE_LABELS.tenant, onPress: () => onOpenManagement(target.tenant) },
        { text: SIDE_LABELS.landlord, onPress: () => onOpenManagement(target.landlord) },
        { text: 'Đóng', style: 'cancel' },
      ]);
    else showDialog(item.title, item.body);
  };

  const header = (
    <View className="pb-3">
      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
            <Text accessibilityRole="header" className="text-xl font-extrabold text-foreground">
              Trung tâm thông báo
            </Text>
            {unreadCount > 0 ? (
              <View className="rounded-full bg-danger-soft px-2.5 py-0.5">
                <Text className="text-xs font-bold text-danger">{unreadCount} chưa đọc</Text>
              </View>
            ) : null}
          </View>
          {unreadCount > 0 ? (
            <Pressable
              onPress={() => void markAllRead()}
              disabled={markingAll}
              accessibilityRole="button"
              accessibilityLabel="Đánh dấu tất cả đã đọc"
              className={`min-h-10 flex-row items-center gap-1.5 rounded-xl border border-border bg-surface px-3 ${markingAll ? 'opacity-50' : ''}`}>
              {markingAll ? (
                <ActivityIndicator size="small" className="text-primary" />
              ) : (
                <Ionicons name="checkmark-done-outline" size={18} className="text-primary" />
              )}
              <Text className="text-xs font-semibold text-foreground">Đã đọc tất cả</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="mt-1.5 text-xs leading-5 text-muted-foreground">
          Theo dõi tiến độ hợp đồng, thanh toán tiền cọc và cập nhật tin đăng thuê nhà.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20 }}
        className="mt-3 grow-0"
        accessibilityRole="tablist">
        {NOTIFICATION_FILTER_TABS.map((item) => {
          const active = item.id === tab;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={`mr-2 min-h-10 justify-center rounded-full px-4 ${active ? 'bg-brand' : 'bg-muted'}`}>
              <Text
                className={`text-xs ${active ? 'font-bold text-on-brand' : 'font-semibold text-secondary'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mt-3 flex-row items-center justify-between px-5">
        <Text className="text-xs font-medium text-muted-foreground">Chỉ chưa đọc</Text>
        <Switch
          value={unreadOnly}
          onValueChange={setUnreadOnly}
          accessibilityLabel="Chỉ chưa đọc"
        />
      </View>

      <View className="mx-5 mt-2 flex-row items-center rounded-2xl bg-muted px-4">
        <Ionicons name="search-outline" size={19} className="text-subtle" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm kiếm nội dung thông báo..."
          accessibilityLabel="Tìm kiếm nội dung thông báo"
          className="ml-2 flex-1 py-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Thông báo" onBack={onBack} />
      {header}
      {loading ? (
        <View className="px-5" accessibilityLabel="Đang tải thông báo">
          {[0, 1, 2, 3].map((key) => (
            <View key={key} className="mb-3 h-28 rounded-2xl bg-muted" />
          ))}
        </View>
      ) : error ? (
        <View className="items-center px-8 py-10">
          <Ionicons name="alert-circle-outline" size={42} className="text-danger" />
          <Text className="mt-3 font-bold text-foreground">Không thể tải thông báo</Text>
          <Text className="mt-1 text-center text-xs text-muted-foreground">{error}</Text>
          <Pressable
            onPress={() => void load()}
            accessibilityRole="button"
            className="mt-4 rounded-xl bg-brand px-5 py-3">
            <Text className="font-semibold text-on-brand">Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
          contentContainerClassName="px-5 pb-10"
          renderItem={({ item }) => (
            <NotificationCard item={item} onPress={() => void open(item)} />
          )}
          ListEmptyComponent={
            <View className="items-center px-4 py-12">
              <Ionicons name="notifications-off-outline" size={42} className="text-subtle" />
              <Text className="mt-3 font-bold text-foreground">Không có thông báo nào</Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">
                {unreadOnly
                  ? 'Bạn đã đọc tất cả thông báo trong danh mục này.'
                  : 'Các hoạt động giao dịch, ký hợp đồng và duyệt tin sẽ xuất hiện tại đây.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            visible.length ? (
              <View className="items-center pt-2">
                <Text className="text-xs font-medium text-muted-foreground">
                  Đang hiển thị <Text className="font-bold text-foreground">{visible.length}</Text>{' '}
                  thông báo
                </Text>
                {moreError ? <Text className="mt-2 text-xs text-danger">{moreError}</Text> : null}
                {hasMore && cursor ? (
                  <Pressable
                    onPress={() => void loadMore()}
                    disabled={loadingMore}
                    accessibilityRole="button"
                    className={`mt-3 min-h-11 flex-row items-center gap-2 rounded-xl border border-border bg-surface px-5 ${loadingMore ? 'opacity-50' : ''}`}>
                    {loadingMore ? (
                      <ActivityIndicator size="small" className="text-primary" />
                    ) : null}
                    <Text className="text-xs font-semibold text-foreground">
                      {loadingMore ? 'Đang tải thêm...' : 'Tải thêm thông báo'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
