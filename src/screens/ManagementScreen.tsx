import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';

import Icon from '@/components/Icon';
import DatePeriodFilter from '@/components/DatePeriodFilter';
import { useDialog } from '@/components/AppDialog';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import TabHeader from '@/components/TabHeader';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import BookingForm from '@/components/BookingForm';
import AppointmentCalendar, { type CalendarState } from '@/components/AppointmentCalendar';
import ListingDraftScreen from '@/screens/ListingDraftScreen';
import BranchManagementScreen from '@/screens/BranchManagementScreen';
import { dateKey } from '@/lib/appointment-calendar';
import { getDatePeriodRange, toLocalDateKey, type DatePeriod } from '@/lib/date-period';
import { apiError } from '@/lib/api-error';
import { getUserProfileApi } from '@/services/userApi';
import {
  getContractDocuments,
  getManagementPage,
  getRentalRequestCounts,
  getAppointmentCalendar,
  getManagementAttentionCounts,
  performManagementAction,
  refreshManagementEntry,
  reportPaymentTransfer,
  statusLabel,
  money,
  type ContractDocument,
  type ManagementAction,
  type ManagementEntry,
  type ManagementSection,
  type AppointmentListFilter,
  type RentalRequestStatus,
} from '@/services/managementApi';
import { getStorageViewUrl, uploadFile, type LocalFile } from '@/services/storageApi';

type Menu = {
  section: ManagementSection;
  title: string;
  icon: ComponentProps<typeof Icon>['name'];
};
const MENUS: Record<'tenant' | 'landlord', Menu[]> = {
  tenant: [
    { section: 'tenant-appointments', title: 'Lịch đi xem', icon: 'calendar-outline' },
    { section: 'tenant-requests', title: 'Yêu cầu đã gửi', icon: 'paper-plane-outline' },
    { section: 'tenant-payments', title: 'Thanh toán', icon: 'card-outline' },
    { section: 'tenant-contracts', title: 'Hợp đồng thuê', icon: 'document-text-outline' },
  ],
  landlord: [
    { section: 'landlord-properties', title: 'Tin đăng của tôi', icon: 'home-outline' },
    { section: 'landlord-branches', title: 'Chi nhánh / Tòa nhà', icon: 'business-outline' },
    { section: 'landlord-appointments', title: 'Lịch xem nhà', icon: 'calendar-outline' },
    { section: 'landlord-requests', title: 'Yêu cầu thuê', icon: 'mail-unread-outline' },
    { section: 'landlord-payments', title: 'Thanh toán', icon: 'wallet-outline' },
    { section: 'landlord-contracts', title: 'Hợp đồng cho thuê', icon: 'document-text-outline' },
  ],
};

const REQUEST_TONES = {
  warning: { border: 'border-warning', fill: 'bg-warning-soft', text: 'text-warning' },
  success: { border: 'border-success', fill: 'bg-success-soft', text: 'text-success' },
  primary: { border: 'border-primary', fill: 'bg-primary-soft', text: 'text-primary' },
  danger: { border: 'border-danger', fill: 'bg-danger-soft', text: 'text-danger' },
  neutral: { border: 'border-border-strong', fill: 'bg-muted', text: 'text-secondary' },
};
function requestTone(status: string) {
  if (status === 'PENDING') return REQUEST_TONES.warning;
  if (status === 'ACCEPTED') return REQUEST_TONES.success;
  if (status === 'COMPLETED') return REQUEST_TONES.primary;
  if (status === 'REJECTED') return REQUEST_TONES.danger;
  return REQUEST_TONES.neutral;
}

function appointmentTone(status: string) {
  if (status === 'PENDING') return REQUEST_TONES.warning;
  if (status === 'CONFIRMED') return REQUEST_TONES.primary;
  if (status === 'COMPLETED') return REQUEST_TONES.success;
  if (status === 'REJECTED' || status === 'CANCELLED') return REQUEST_TONES.danger;
  return REQUEST_TONES.neutral;
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi');
}

function EntryDetail({
  section,
  initialEntry,
  userId,
  onBack,
  onChanged,
  onOpenListing,
  onEditListing,
}: {
  section: ManagementSection;
  initialEntry: ManagementEntry;
  userId: string;
  onBack: () => void;
  onChanged: () => void;
  onOpenListing: (id: string, own?: boolean, section?: ManagementSection) => void;
  onEditListing: (id: string) => void;
}) {
  const showDialog = useDialog();
  const [entry, setEntry] = useState(initialEntry);
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [proof, setProof] = useState<LocalFile | null>(null);
  const [reference, setReference] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntry(await refreshManagementEntry(section, initialEntry, userId));
      if (section.endsWith('-contracts')) setDocuments(await getContractDocuments(initialEntry.id));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [section, initialEntry, userId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: ManagementAction) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await performManagementAction(section, entry, action, reason);
      onChanged();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  async function chooseProof() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file.size || file.size > 15 * 1024 * 1024) throw new Error('Chứng từ tối đa 15 MB.');
      setProof({
        uri: file.uri,
        fileName: file.name,
        contentType: file.mimeType || 'application/octet-stream',
        sizeBytes: file.size,
      });
    } catch (e) {
      setError(apiError(e));
    }
  }
  async function reportTransfer() {
    if (!entry.payment || !proof || busy) return;
    setBusy(true);
    setError(null);
    try {
      const stored = await uploadFile(proof, {
        purpose: 'PAYMENT_PROOF',
        visibility: 'PRIVATE',
        referenceType: 'PAYMENT_REQUEST',
        referenceId: entry.id,
      });
      await reportPaymentTransfer(entry.payment, stored.id, reference);
      onChanged();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  async function openDocument(doc: ContractDocument) {
    setError(null);
    try {
      const url =
        doc.viewUrl ||
        doc.downloadUrl ||
        (doc.storageObjectId ? await getStorageViewUrl(doc.storageObjectId) : null);
      if (!url) throw new Error('Văn bản chưa có tệp để xem.');
      await Linking.openURL(url);
    } catch (e) {
      setError(apiError(e));
    }
  }
  if (rescheduling && entry.appointment)
    return (
      <BookingForm
        listingId={entry.appointment.listingId}
        appointment={entry.appointment}
        onBack={() => setRescheduling(false)}
        onSuccess={onChanged}
      />
    );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Chi tiết" onBack={onBack} />
      <ScrollView
        contentContainerClassName="px-5 pb-10 pt-5"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Text className="text-xl font-bold text-foreground">{entry.title}</Text>
        <Text
          className={`mt-2 self-start rounded-full px-3 py-2 text-sm font-bold ${section.endsWith('-requests') ? `${requestTone(entry.status).fill} ${requestTone(entry.status).text}` : 'bg-primary-soft text-primary'}`}>
          {statusLabel(entry.status)}
        </Text>
        <ErrorNotice message={error} />
        {error && !busy ? <Button label="Tải lại chi tiết" onPress={load} /> : null}
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
            onPress={() =>
              onOpenListing(entry.listingId!, section.startsWith('landlord-'), section)
            }
          />
        ) : null}
        {section === 'landlord-properties' &&
        ['APARTMENT', 'HOUSE', 'ROOM'].includes(entry.category ?? '') &&
        !['RENTED', 'RENTED_EXTERNALLY', 'VIOLATION'].includes(entry.status) ? (
          <Button label="Chỉnh sửa tin đăng" onPress={() => onEditListing(entry.id)} />
        ) : null}
        {section.endsWith('-contracts') ? (
          <View className="mt-5">
            <Text className="font-bold text-foreground">Văn bản hợp đồng</Text>
            {loading ? (
              <ActivityIndicator className="mt-3 text-primary" />
            ) : documents.length ? (
              documents.map((doc) => (
                <Button
                  key={doc.id}
                  label={(doc.fileName || doc.documentType) + ' · ' + statusLabel(doc.status)}
                  disabled={doc.status !== 'READY'}
                  onPress={() => openDocument(doc)}
                />
              ))
            ) : (
              <Text className="mt-2 text-sm text-muted-foreground">Chưa có văn bản được tạo.</Text>
            )}
          </View>
        ) : null}
        {entry.payment?.qrImageUrl ? (
          <Image
            accessibilityLabel="Mã QR chuyển khoản"
            source={{ uri: entry.payment.qrImageUrl }}
            resizeMode="contain"
            className="mt-5 h-64 w-full rounded-2xl bg-logo"
          />
        ) : null}
        {entry.payment?.evidences?.map((evidence) => (
          <Button
            key={evidence.storageObjectId}
            label="Xem chứng từ thanh toán"
            onPress={async () => {
              try {
                await Linking.openURL(await getStorageViewUrl(evidence.storageObjectId));
              } catch (e) {
                setError(apiError(e));
              }
            }}
          />
        ))}
        {!loading &&
        !error &&
        entry.payment?.payerId === userId &&
        ['AWAITING_TRANSFER', 'REJECTED', 'OVERDUE'].includes(entry.status) ? (
          <View className="mt-5 rounded-2xl border border-border bg-surface p-4">
            <Text className="font-bold text-foreground">Báo chuyển khoản</Text>
            <Text className="mt-2 text-sm leading-5 text-muted-foreground">
              Chuyển đúng số tiền và nội dung ở trên. Chỉ báo sau khi ngân hàng xác nhận chuyển
              thành công.
            </Text>
            <Field
              label="Mã giao dịch ngân hàng (nếu có)"
              value={reference}
              onChangeText={setReference}
              editable={!busy}
              maxLength={100}
            />
            <Button
              label={proof ? 'Chứng từ: ' + proof.fileName : 'Chọn chứng từ ảnh/PDF'}
              onPress={chooseProof}
              disabled={busy}
            />
            <Button
              label="Tôi đã chuyển khoản"
              busy={busy}
              disabled={!proof}
              onPress={() =>
                showDialog(
                  'Xác nhận khai báo',
                  'Bạn xác nhận đã chuyển ' +
                    money(entry.payment!.totalAmount) +
                    ' với nội dung ' +
                    entry.payment!.transferReference +
                    '?',
                  [
                    { text: 'Chưa', style: 'cancel' },
                    { text: 'Đã chuyển', onPress: () => void reportTransfer() },
                  ]
                )
              }
            />
          </View>
        ) : null}
        {!loading &&
        !error &&
        entry.appointment &&
        section === 'tenant-appointments' &&
        ['PENDING', 'CONFIRMED'].includes(entry.status) &&
        !entry.appointment.rescheduleRequested ? (
          <Button label="Đề xuất đổi lịch" disabled={busy} onPress={() => setRescheduling(true)} />
        ) : null}
        {entry.actions.some((action) => action.needsReason) ? (
          <Field
            label="Lý do (bắt buộc khi từ chối/hủy/đối soát)"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            editable={!busy}
          />
        ) : null}
        {entry.actions.map((option) => (
          <Button
            key={option.action}
            label={option.label}
            disabled={loading || Boolean(error) || (option.needsReason && !reason.trim())}
            busy={busy}
            danger={option.danger}
            onPress={() =>
              showDialog(
                option.label,
                option.action === 'accept'
                  ? 'Chấp thuận sẽ giữ chỗ căn nhà và có thể hủy các yêu cầu cạnh tranh theo chính sách hệ thống. Tiếp tục?'
                  : option.action === 'confirm-receipt'
                    ? 'Chỉ xác nhận sau khi kiểm tra ngân hàng đã nhận đủ tiền. Tiếp tục?'
                    : 'Xác nhận thao tác với “' + entry.title + '”?',
                [
                  { text: 'Quay lại', style: 'cancel' },
                  {
                    text: 'Xác nhận',
                    style: option.danger ? 'destructive' : 'default',
                    onPress: () => void act(option.action),
                  },
                ]
              )
            }
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ManagementScreen({
  onSelectTab,
  onOpenListing,
  initialSection,
  onExit,
}: {
  onSelectTab: (tab: MainTab) => void;
  onOpenListing: (id: string, own?: boolean, section?: ManagementSection) => void;
  initialSection?: ManagementSection | null;
  onExit?: () => void;
}) {
  const [role, setRole] = useState<'tenant' | 'landlord'>(
    initialSection?.startsWith('landlord-') ? 'landlord' : 'tenant'
  );
  const [section, setSection] = useState<ManagementSection | null>(initialSection ?? null);
  const [entry, setEntry] = useState<ManagementEntry | null>(null);
  const [creatingListing, setCreatingListing] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagementEntry[]>([]);
  const [attentionCounts, setAttentionCounts] = useState<
    Partial<Record<ManagementSection, number>>
  >({});
  const [attentionRefresh, setAttentionRefresh] = useState(0);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [requestCounts, setRequestCounts] = useState<{
    section: ManagementSection;
    items: Awaited<ReturnType<typeof getRentalRequestCounts>>;
  } | null>(null);
  const [requestSelection, setRequestSelection] = useState<{
    section: ManagementSection;
    status: RentalRequestStatus | null;
  } | null>(null);
  const [requestCountsLoading, setRequestCountsLoading] = useState(false);
  const [requestCountsError, setRequestCountsError] = useState<string | null>(null);
  const [requestCountsVersion, setRequestCountsVersion] = useState(0);
  const [appointmentView, setAppointmentView] = useState<'calendar' | 'list'>('calendar');
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentListFilter>('ALL');
  const [listQuery, setListQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('ALL');
  const [dateAnchor, setDateAnchor] = useState(() => new Date());
  const [calendarState, setCalendarState] = useState<CalendarState>(() => ({
    view: 'month',
    anchor: new Date(),
    selected: dateKey(new Date()),
  }));
  const isAppointments = Boolean(section?.endsWith('-appointments'));
  const isRequests = Boolean(section?.endsWith('-requests'));
  const requestStatus = requestSelection?.section === section ? requestSelection.status : null;
  const visibleRequestTabs =
    requestCounts?.section === section ? requestCounts.items.filter((item) => item.count > 0) : [];
  const showCalendar = isAppointments && appointmentView === 'calendar';
  const listFilter = isAppointments && !showCalendar ? appointmentFilter : 'ALL';
  const tenantHasAttention =
    (attentionCounts['tenant-appointments'] ?? 0) > 0 ||
    (attentionCounts['tenant-requests'] ?? 0) > 0;
  const landlordHasAttention =
    (attentionCounts['landlord-properties'] ?? 0) > 0 ||
    (attentionCounts['landlord-appointments'] ?? 0) > 0 ||
    (attentionCounts['landlord-requests'] ?? 0) > 0;
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
  const requestId = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);
  useEffect(() => {
    let active = true;
    void getManagementAttentionCounts(attentionRefresh > 0).then((counts) => {
      if (active) setAttentionCounts(counts);
    });
    return () => {
      active = false;
    };
  }, [attentionRefresh]);
  useEffect(() => {
    if (!section?.endsWith('-requests')) return;
    let active = true;
    setRequestSelection({ section, status: null });
    setRequestCounts(null);
    setRequestCountsError(null);
    setRequestCountsLoading(true);
    void getRentalRequestCounts(section.startsWith('landlord-'))
      .then((items) => {
        if (!active) return;
        setRequestCounts({ section, items });
        setRequestSelection({
          section,
          status: items.find((item) => item.count > 0)?.status ?? null,
        });
      })
      .catch((e) => {
        if (active) setRequestCountsError(apiError(e));
      })
      .finally(() => {
        if (active) setRequestCountsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [section, requestCountsVersion]);
  const load = useCallback(
    async (nextPage = 1) => {
      const ticket = ++requestId.current;
      if (!section || section === 'landlord-branches' || (isRequests && !requestStatus)) return;
      setLoading(true);
      setError(null);
      try {
        const profile = await getUserProfileApi();
        const items = showCalendar
          ? await getAppointmentCalendar(section.startsWith('landlord-'))
          : null;
        const data = items
          ? { items, hasMore: false, total: items.length }
          : await getManagementPage(
              section,
              nextPage,
              profile.id,
              listFilter,
              requestStatus ?? undefined
            );
        if (ticket !== requestId.current) return;
        setUserId(profile.id);
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
    [section, showCalendar, listFilter, isRequests, requestStatus]
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
  const title =
    [...MENUS.tenant, ...MENUS.landlord].find((item) => item.section === section)?.title ||
    'Quản lý';
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
  if (section === 'landlord-branches')
    return <BranchManagementScreen onBack={onExit ?? (() => setSection(null))} />;
  if (entry && section)
    return (
      <EntryDetail
        key={entry.id}
        section={section}
        initialEntry={entry}
        userId={userId}
        onBack={() => setEntry(null)}
        onChanged={() => {
          setEntry(null);
          setAttentionRefresh((current) => current + 1);
          if (isRequests) setRequestCountsVersion((current) => current + 1);
          else void load();
        }}
        onOpenListing={onOpenListing}
        onEditListing={setEditingListingId}
      />
    );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {section ? (
        <ScreenHeader title={title} onBack={onExit ?? (() => setSection(null))} />
      ) : (
        <TabHeader title="Quản lý">
          <Text className="mt-1 text-sm text-muted-foreground">
            Theo dõi thuê nhà và cho thuê trên HomeSpace
          </Text>
        </TabHeader>
      )}
      <ScrollView
        contentContainerClassName="px-5 pb-8 pt-5"
        refreshControl={
          section ? (
            <RefreshControl
              refreshing={loading || (isRequests && requestCountsLoading)}
              onRefresh={() => {
                setAttentionRefresh((current) => current + 1);
                if (isRequests) setRequestCountsVersion((current) => current + 1);
                else void load();
              }}
            />
          ) : undefined
        }>
        {!section ? (
          <>
            <View className="flex-row gap-2">
              {(['tenant', 'landlord'] as const).map((value) => {
                const hasAttention = value === 'tenant' ? tenantHasAttention : landlordHasAttention;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setRole(value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: value === role }}
                    className={
                      value === role
                        ? 'min-h-12 flex-1 items-center justify-center rounded-xl border border-primary bg-primary-soft'
                        : 'min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-surface'
                    }>
                    <View className="flex-row items-center">
                      <Text
                        className={
                          value === role ? 'font-bold text-primary' : 'font-bold text-secondary'
                        }>
                        {value === 'tenant' ? 'Người thuê' : 'Cho thuê'}
                      </Text>
                      {hasAttention ? (
                        <View className="ml-2 h-2.5 w-2.5 rounded-full bg-danger" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {MENUS[role].map((item) => (
              <Pressable
                key={item.section}
                onPress={() => setSection(item.section)}
                accessibilityRole="button"
                className="mt-3 flex-row items-center rounded-2xl border border-border bg-surface p-4">
                <Icon name={item.icon} size={25} className="text-primary" />
                <Text className="ml-3 flex-1 font-bold text-foreground">{item.title}</Text>
                {(attentionCounts[item.section] ?? 0) > 0 ? (
                  <View className="mr-2 h-2.5 w-2.5 rounded-full bg-danger" />
                ) : null}
                <Icon name="chevron-forward" size={20} className="text-subtle" />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            {section === 'landlord-properties' ? (
              <Pressable
                onPress={() => setCreatingListing(true)}
                accessibilityRole="button"
                className="mb-5 min-h-14 flex-row items-center justify-center rounded-2xl bg-brand px-4">
                <Icon name="add-circle-outline" size={22} className="text-on-brand" />
                <Text className="ml-2 font-bold text-on-brand">Đăng tin mới</Text>
              </Pressable>
            ) : null}
            {isAppointments ? (
              <View className="mb-4 flex-row gap-2" accessibilityRole="tablist">
                {(['calendar', 'list'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: appointmentView === mode }}
                    onPress={() => setAppointmentView(mode)}
                    className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border ${appointmentView === mode ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                    <Icon
                      name={mode === 'calendar' ? 'calendar-outline' : 'list-outline'}
                      size={19}
                      className={appointmentView === mode ? 'text-primary' : 'text-secondary'}
                    />
                    <Text
                      className={
                        appointmentView === mode
                          ? 'font-bold text-primary'
                          : 'font-semibold text-secondary'
                      }>
                      {mode === 'calendar' ? 'Lịch' : 'Danh sách'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {isAppointments && !showCalendar ? (
              <View className="mb-4">
                <View className="flex-row gap-2" accessibilityRole="tablist">
                  {(
                    [
                      { value: 'ALL', label: 'Tất cả' },
                      { value: 'UNVIEWED', label: 'Chưa xem' },
                      { value: 'COMPLETED', label: 'Hoàn thành' },
                    ] as const
                  ).map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: appointmentFilter === option.value }}
                      onPress={() => setAppointmentFilter(option.value)}
                      className={`min-h-11 flex-1 items-center justify-center rounded-full border px-2 ${appointmentFilter === option.value ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                      <Text
                        className={
                          appointmentFilter === option.value
                            ? 'text-xs font-bold text-primary'
                            : 'text-xs font-semibold text-secondary'
                        }>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {appointmentFilter === 'UNVIEWED' ? (
                  <Text className="mt-2 text-xs text-muted-foreground">
                    Lịch đang chờ duyệt hoặc đã xác nhận, chưa xem xong.
                  </Text>
                ) : null}
              </View>
            ) : null}
            {isRequests && visibleRequestTabs.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-5"
                accessibilityRole="tablist">
                {visibleRequestTabs.map((tab) => {
                  const tone = requestTone(tab.status);
                  const selected = requestStatus === tab.status;
                  return (
                    <Pressable
                      key={tab.status}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      onPress={() => setRequestSelection({ section: section!, status: tab.status })}
                      className={`mr-2 min-h-12 flex-row items-center justify-center gap-2 rounded-xl border px-4 ${selected ? `${tone.border} ${tone.fill}` : 'border-border bg-surface'}`}>
                      <Text className={`font-semibold ${selected ? tone.text : 'text-secondary'}`}>
                        {statusLabel(tab.status)}
                      </Text>
                      <Text
                        className={`min-w-6 overflow-hidden rounded-full px-1.5 py-0.5 text-center text-xs font-bold ${selected ? `${tone.fill} ${tone.text}` : 'bg-muted text-secondary'}`}>
                        {tab.count}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {!showCalendar ? (
              <>
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
                {!isRequests && !isAppointments && statusOptions.length > 1 ? (
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
              </>
            ) : null}
            <ErrorNotice message={isRequests ? requestCountsError : null} />
            {isRequests && requestCountsError ? (
              <Button
                label="Thử lại"
                onPress={() => setRequestCountsVersion((current) => current + 1)}
              />
            ) : null}
            <ErrorNotice message={error} />
            {error ? <Button label="Thử lại" onPress={() => load()} disabled={loading} /> : null}
            {showCalendar ? (
              <AppointmentCalendar
                state={calendarState}
                onChange={setCalendarState}
                rows={rows}
                loading={loading}
                owner={section!.startsWith('landlord-')}
                onSelect={setEntry}
              />
            ) : (
              <>
                <Text className="mb-3 text-sm text-muted-foreground">
                  {visibleRows.length}
                  {listQuery || statusFilter || datePeriod !== 'ALL' ? ` / ${total}` : ''}{' '}
                  {isRequests ? 'yêu cầu' : isAppointments ? 'lịch hẹn' : 'mục'}
                </Text>
                {visibleRows.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => setEntry(row)}
                    accessibilityRole="button"
                    className={`mb-3 rounded-2xl border bg-surface p-4 ${isRequests ? `border-l-4 ${requestTone(row.status).border}` : isAppointments ? `border-l-4 ${appointmentTone(row.status).border}` : 'border-border'}`}>
                    <View className="flex-row items-start gap-3">
                      <Text className="flex-1 font-bold text-foreground">{row.title}</Text>
                      {isRequests ? (
                        <Icon name="chevron-forward" size={18} className="text-subtle" />
                      ) : null}
                    </View>
                    <Text
                      className={
                        isRequests
                          ? `mt-3 self-start overflow-hidden rounded-full px-3 py-1 text-xs font-bold ${requestTone(row.status).fill} ${requestTone(row.status).text}`
                          : isAppointments
                            ? `mt-3 self-start overflow-hidden rounded-full px-3 py-1 text-xs font-bold ${appointmentTone(row.status).fill} ${appointmentTone(row.status).text}`
                            : 'mt-2 text-xs text-primary'
                      }>
                      {statusLabel(row.status)}
                    </Text>
                    {row.appointment?.rescheduleRequested ? (
                      <Text className="mt-2 self-start rounded-full bg-warning-soft px-3 py-1 text-xs font-bold text-warning">
                        Có yêu cầu đổi lịch
                      </Text>
                    ) : null}
                    <Text
                      className={`${isRequests ? 'mt-2' : 'mt-1'} text-xs text-muted-foreground`}>
                      {row.fields[0]?.[1]}
                    </Text>
                    {isRequests ? (
                      <Text className="mt-2 text-xs font-semibold text-secondary">
                        Vào ở: {row.fields.find(([label]) => label === 'Ngày vào ở')?.[1]} ·{' '}
                        {row.fields.find(([label]) => label === 'Thời hạn')?.[1]}
                      </Text>
                    ) : null}
                    {row.appointment ? (
                      <Text className="mt-2 text-xs font-semibold text-secondary">
                        {row.appointment.appointmentDate.split('-').reverse().join('/')} ·{' '}
                        {row.appointment.startTime.slice(0, 5)}–
                        {row.appointment.endTime.slice(0, 5)}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </>
            )}
            {loading || (isRequests && requestCountsLoading) ? (
              <ActivityIndicator className="my-6 text-primary" />
            ) : !showCalendar &&
              !visibleRows.length &&
              !error &&
              !(isRequests && requestCountsError) ? (
              <Text className="py-10 text-center text-muted-foreground">
                {listQuery || statusFilter || datePeriod !== 'ALL'
                  ? hasMore
                    ? 'Chưa tìm thấy mục phù hợp trong phần đã tải. Hãy tải thêm để tìm tiếp.'
                    : 'Không tìm thấy mục phù hợp với bộ lọc.'
                  : isRequests
                    ? requestStatus
                      ? `Chưa có yêu cầu ${statusLabel(requestStatus).toLowerCase()}.`
                      : 'Chưa có yêu cầu thuê nào.'
                    : isAppointments && listFilter === 'UNVIEWED'
                      ? 'Không có lịch chưa xem.'
                      : isAppointments && listFilter === 'COMPLETED'
                        ? 'Chưa có lịch hoàn thành.'
                        : 'Chưa có dữ liệu trong mục này.'}
              </Text>
            ) : null}
            {hasMore ? (
              <Button label="Tải thêm" onPress={() => load(page + 1)} disabled={loading} />
            ) : null}
          </>
        )}
      </ScrollView>
      <BottomTabBar
        active="management"
        onSelect={onSelectTab}
        attentionVersion={attentionRefresh}
      />
    </SafeAreaView>
  );
}
