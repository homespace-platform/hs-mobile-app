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

import Icon from '@/components/Icon';
import DatePeriodFilter from '@/components/DatePeriodFilter';
import { useDialog } from '@/components/AppDialog';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import { Button, ErrorNotice, ScreenHeader } from '@/components/Screen';
import AppointmentsScreen from '@/components/appointment/manage/AppointmentsScreen';
import ListingDraftScreen from '@/screens/ListingDraftScreen';
import BranchManagementScreen from '@/screens/BranchManagementScreen';
import { getDatePeriodRange, toLocalDateKey, type DatePeriod } from '@/lib/date-period';
import { apiError } from '@/lib/api-error';
import {
  getManagementPage,
  performManagementAction,
  statusLabel,
  type ManagementAction,
  type ManagementEntry,
  type ManagementSection,
} from '@/services/managementApi';

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi');
}

function EntryDetail({
  entry,
  onBack,
  onChanged,
  onOpenListing,
  onEditListing,
}: {
  entry: ManagementEntry;
  onBack: () => void;
  onChanged: () => void;
  onOpenListing: (id: string) => void;
  onEditListing: (id: string) => void;
}) {
  const showDialog = useDialog();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(action: ManagementAction) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await performManagementAction(entry, action);
      onChanged();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Chi tiết" onBack={onBack} />
      <ScrollView contentContainerClassName="px-5 pb-10 pt-5">
        <Text className="text-xl font-bold text-foreground">{entry.title}</Text>
        <Text className="mt-2 self-start rounded-full bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
          {statusLabel(entry.status)}
        </Text>
        <ErrorNotice message={error} />
        {error && !busy ? <Button label="Tải lại chi tiết" onPress={() => setError(null)} /> : null}
        {entry.fields.map(([label, value]) => (
          <View key={label} className="mt-4 border-b border-border pb-3">
            <Text className="text-xs text-muted-foreground">{label}</Text>
            <Text selectable className="mt-1 text-sm font-semibold text-foreground">
              {value || '—'}
            </Text>
          </View>
        ))}
        {entry.listingId ? (
          <Button
            label="Xem tin đăng liên quan"
            disabled={busy}
            onPress={() => onOpenListing(entry.listingId!)}
          />
        ) : null}
        {['APARTMENT', 'HOUSE', 'ROOM'].includes(entry.category ?? '') &&
        !['RENTED', 'RENTED_EXTERNALLY', 'VIOLATION'].includes(entry.status) ? (
          <Button label="Chỉnh sửa tin đăng" onPress={() => onEditListing(entry.id)} />
        ) : null}
        {entry.actions.map((option) => (
          <Button
            key={option.action}
            label={option.label}
            disabled={Boolean(error)}
            busy={busy}
            danger={option.danger}
            onPress={() =>
              showDialog(option.label, 'Xác nhận thao tác với “' + entry.title + '”?', [
                { text: 'Quay lại', style: 'cancel' },
                {
                  text: 'Xác nhận',
                  style: option.danger ? 'destructive' : 'default',
                  onPress: () => void act(option.action),
                },
              ])
            }
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Own listings, branches and appointments. Rental sections have their own screens (App). */
export default function ManagementScreen({
  onSelectTab,
  onOpenListing,
  initialSection: section,
  onExit,
  linkedAppointmentId,
  onLinkConsumed,
}: {
  onSelectTab: (tab: MainTab) => void;
  onOpenListing: (id: string, own?: boolean, section?: ManagementSection) => void;
  initialSection: ManagementSection;
  onExit: () => void;
  linkedAppointmentId?: string | null;
  onLinkConsumed?: () => void;
}) {
  const [entry, setEntry] = useState<ManagementEntry | null>(null);
  const [creatingListing, setCreatingListing] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagementEntry[]>([]);
  const [attentionRefresh, setAttentionRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [listQuery, setListQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('ALL');
  const [dateAnchor, setDateAnchor] = useState(() => new Date());
  const statusOptions = Array.from(new Set(rows.map((row) => row.status))).sort((a, b) =>
    statusLabel(a).localeCompare(statusLabel(b), 'vi')
  );
  const dateRange = getDatePeriodRange(dateAnchor, datePeriod);
  const normalizedQuery = normalizeSearch(listQuery.trim());
  const visibleRows = rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    const rowDate = toLocalDateKey(row.date);
    if (dateRange && (!rowDate || rowDate < dateRange.start || rowDate > dateRange.end))
      return false;
    if (!normalizedQuery) return true;
    return normalizeSearch(
      [
        row.title,
        statusLabel(row.status),
        ...row.fields.flatMap(([label, value]) => [label, value]),
      ].join(' ')
    ).includes(normalizedQuery);
  });
  const filtered = Boolean(listQuery || statusFilter || datePeriod !== 'ALL');
  const requestId = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);
  const load = useCallback(
    async (nextPage = 1) => {
      const ticket = ++requestId.current;
      if (section !== 'landlord-properties') return;
      setLoading(true);
      setError(null);
      try {
        const data = await getManagementPage(nextPage);
        if (ticket !== requestId.current) return;
        setRows((current) =>
          nextPage === 1
            ? data.items
            : [
                ...current.filter((item) => !data.items.some((next) => next.id === item.id)),
                ...data.items,
              ]
        );
        setPage(nextPage);
        setHasMore(data.hasMore);
        setTotal(data.total);
      } catch (e) {
        if (ticket === requestId.current) setError(apiError(e));
      } finally {
        if (ticket === requestId.current) setLoading(false);
      }
    },
    [section]
  );
  useEffect(() => {
    setRows([]);
    setListQuery('');
    setStatusFilter(null);
    setDatePeriod('ALL');
    setHasMore(false);
    setTotal(0);
    void load();
    return invalidateRequests;
  }, [load, invalidateRequests]);
  if (creatingListing)
    return (
      <ListingDraftScreen
        onBack={() => setCreatingListing(false)}
        onSaved={() => {
          setCreatingListing(false);
          setAttentionRefresh((current) => current + 1);
          void load();
        }}
      />
    );
  if (editingListingId)
    return (
      <ListingDraftScreen
        listingId={editingListingId}
        onBack={() => setEditingListingId(null)}
        onSaved={() => {
          setEditingListingId(null);
          setEntry(null);
          setAttentionRefresh((current) => current + 1);
          void load();
        }}
      />
    );
  if (section === 'landlord-branches') return <BranchManagementScreen onBack={onExit} />;
  if (section === 'tenant-appointments' || section === 'landlord-appointments') {
    const owner = section === 'landlord-appointments';
    return (
      <AppointmentsScreen
        key={section}
        role={owner ? 'OWNER' : 'RENTER'}
        linkedAppointmentId={linkedAppointmentId}
        onLinkConsumed={onLinkConsumed}
        onBack={onExit}
        onSelectTab={onSelectTab}
        onOpenListing={(id) => onOpenListing(id, owner, section)}
      />
    );
  }
  if (entry)
    return (
      <EntryDetail
        key={entry.id}
        entry={entry}
        onBack={() => setEntry(null)}
        onChanged={() => {
          setEntry(null);
          setAttentionRefresh((current) => current + 1);
          void load();
        }}
        onOpenListing={(id) => onOpenListing(id, true, section)}
        onEditListing={setEditingListingId}
      />
    );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Tin đăng của tôi" onBack={onExit} />
      <ScrollView
        contentContainerClassName="px-5 pb-8 pt-5"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setAttentionRefresh((current) => current + 1);
              void load();
            }}
          />
        }>
        <Pressable
          onPress={() => setCreatingListing(true)}
          accessibilityRole="button"
          className="mb-5 min-h-14 flex-row items-center justify-center rounded-2xl bg-brand px-4">
          <Icon name="add-circle-outline" size={22} className="text-on-brand" />
          <Text className="ml-2 font-bold text-on-brand">Đăng tin mới</Text>
        </Pressable>
        <View className="mb-3 min-h-12 flex-row items-center rounded-xl border border-border bg-surface px-3">
          <Icon name="search-outline" size={19} className="text-subtle" />
          <TextInput
            value={listQuery}
            onChangeText={setListQuery}
            placeholder="Tìm theo tên, địa chỉ hoặc trạng thái"
            returnKeyType="search"
            accessibilityLabel="Tìm kiếm trong danh sách quản lý"
            className="ml-2 min-h-12 flex-1 py-2 text-sm text-foreground placeholder:text-subtle"
          />
          {listQuery ? (
            <Pressable
              onPress={() => setListQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Xóa nội dung tìm kiếm"
              className="min-h-10 min-w-10 items-center justify-center">
              <Icon name="close-circle" size={19} className="text-subtle" />
            </Pressable>
          ) : null}
        </View>
        <DatePeriodFilter
          period={datePeriod}
          anchor={dateAnchor}
          onPeriodChange={setDatePeriod}
          onAnchorChange={setDateAnchor}
        />
        {statusOptions.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            accessibilityRole="tablist">
            {[null, ...statusOptions].map((status) => {
              const selected = statusFilter === status;
              return (
                <Pressable
                  key={status ?? 'ALL'}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setStatusFilter(status)}
                  className={`mr-2 min-h-11 flex-row items-center gap-2 rounded-full border px-4 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                  <Text
                    className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-secondary'}`}>
                    {status ? statusLabel(status) : 'Tất cả'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <ErrorNotice message={error} />
        {error ? <Button label="Thử lại" onPress={() => load()} disabled={loading} /> : null}
        <Text className="mb-3 text-sm text-muted-foreground">
          {visibleRows.length}
          {filtered ? ` / ${total}` : ''} mục
        </Text>
        {visibleRows.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => setEntry(row)}
            accessibilityRole="button"
            className="mb-3 rounded-2xl border border-border bg-surface p-4">
            <View className="flex-row items-start gap-3">
              <Text className="flex-1 font-bold text-foreground">{row.title}</Text>
            </View>
            <Text className="mt-2 text-xs text-primary">{statusLabel(row.status)}</Text>
            <Text className="mt-1 text-xs text-muted-foreground">{row.fields[0]?.[1]}</Text>
          </Pressable>
        ))}
        {loading ? (
          <ActivityIndicator className="my-6 text-primary" />
        ) : !visibleRows.length && !error ? (
          <Text className="py-10 text-center text-muted-foreground">
            {filtered
              ? hasMore
                ? 'Chưa tìm thấy mục phù hợp trong phần đã tải. Hãy tải thêm để tìm tiếp.'
                : 'Không tìm thấy mục phù hợp với bộ lọc.'
              : 'Chưa có dữ liệu trong mục này.'}
          </Text>
        ) : null}
        {hasMore ? (
          <Button label="Tải thêm" onPress={() => load(page + 1)} disabled={loading} />
        ) : null}
      </ScrollView>
      <BottomTabBar
        active="management"
        onSelect={onSelectTab}
        attentionVersion={attentionRefresh}
      />
    </SafeAreaView>
  );
}
