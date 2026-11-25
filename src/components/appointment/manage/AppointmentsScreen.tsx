// Port of hs-web-app app/dashboard/viewing-schedules/page.tsx (OWNER) and
// .../my-bookings/page.tsx (RENTER), with their notification and deep-link hooks.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDialog } from '@/components/AppDialog';
import BookingAppointmentModal from '@/components/appointment/BookingAppointmentModal';
import AppointmentCalendar, { type CalendarState } from '@/components/AppointmentCalendar';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import Icon from '@/components/Icon';
import PageBar from '@/components/PageBar';
import { Button, ErrorNotice, ScreenHeader } from '@/components/Screen';
import {
  LIST_PAGE_SIZE,
  OWNER_ACTION_DIALOGS,
  STATUS_TABS,
  validateOwnerDialog,
  type AppointmentAction,
  type AppointmentTab,
  type OwnerDialogType,
} from '@/lib/appointment';
import { PERMISSIONS } from '@/lib/permissions';
import { subscribeNotificationEvents } from '@/lib/realtime/connections';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { getAppointment } from '@/services/appointmentApi';
import { markAppointmentNoticeSeen } from '@/services/managementApi';
import { getUserProfileApi } from '@/services/userApi';
import type { AppointmentResponse, AppointmentViewRole } from '@/types/appointment';

import ActionDialog from './ActionDialog';
import AppointmentCard from './AppointmentCard';
import AppointmentDateFilter from './AppointmentDateFilter';
import AppointmentDetailModal from './AppointmentDetailModal';
import {
  createCoalescedRunner,
  fetchAppointmentList,
  fetchStatusCounts,
  getActionMessages,
  isAppointmentChangeEvent,
  PAGE_COPY,
  queryKey,
  resolveDeepLink,
  runAppointmentAction,
  serverMessage,
  type AppointmentList,
  type ServerAction,
} from './logic';

export default function AppointmentsScreen({
  role,
  linkedAppointmentId,
  onLinkConsumed,
  onBack,
  onSelectTab,
  onOpenListing,
}: {
  role: AppointmentViewRole;
  /** Appointment of a tapped notification (web `?appointmentId=`). */
  linkedAppointmentId?: string | null;
  onLinkConsumed?: () => void;
  onBack: () => void;
  onSelectTab: (tab: MainTab) => void;
  onOpenListing: (listingId: string) => void;
}) {
  const showDialog = useDialog();
  const manageGate = useFeatureGate(PERMISSIONS.APPOINTMENT_MANAGE);
  const bookGate = useFeatureGate(PERMISSIONS.APPOINTMENT_BOOK);
  const copy = PAGE_COPY[role];

  const [tab, setTab] = useState<AppointmentTab>('CALENDAR');
  const [date, setDate] = useState<string>();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<(AppointmentList & { key: string }) | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarState>(() => ({
    view: 'month',
    anchor: new Date(),
  }));
  const [detail, setDetail] = useState<AppointmentResponse | null>(null);
  const [dialog, setDialog] = useState<{
    action: OwnerDialogType;
    appointment: AppointmentResponse;
  } | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentResponse | null>(null);
  const [attentionVersion, setAttentionVersion] = useState(0);

  const key = queryKey({ tab, date, page });
  const ticket = useRef(0);
  const load = useCallback(async () => {
    const current = ++ticket.current;
    setLoading(true);
    setError(null);
    try {
      const query = { tab, date, page };
      const list = await fetchAppointmentList(role, query);
      if (current !== ticket.current) return;
      // The last row of the last page was just moved to another status.
      if (tab !== 'CALENDAR' && !list.rows.length && page > list.totalPages) {
        setPage(list.totalPages);
        return;
      }
      setData({ ...list, key: queryKey(query) });
      const nextCounts = await fetchStatusCounts(role, tab, list.total);
      if (current === ticket.current) setCounts(nextCounts);
    } catch {
      if (current === ticket.current) setError(PAGE_COPY[role].loadError);
    } finally {
      if (current === ticket.current) setLoading(false);
    }
  }, [role, tab, date, page]);
  const invalidate = useCallback(() => {
    ticket.current++;
  }, []);
  useEffect(() => {
    void load();
    return invalidate;
  }, [load, invalidate]);

  // Work that finishes later (actions, realtime) must reload what is on screen now.
  const loadRef = useRef(load);
  loadRef.current = load;
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const consumeRef = useRef(onLinkConsumed);
  consumeRef.current = onLinkConsumed;

  const reload = () => {
    setAttentionVersion((value) => value + 1);
    void loadRef.current();
  };

  useEffect(() => {
    const runner = createCoalescedRunner(async (isDisposed) => {
      await loadRef.current();
      const id = detailRef.current?.id;
      if (!id || isDisposed()) return;
      // Close stale actions if the open detail can no longer be verified.
      const updated = await getAppointment(id).catch(() => null);
      if (!isDisposed()) setDetail((value) => (value?.id === id ? updated : value));
    });
    const unsubscribe = subscribeNotificationEvents((event, payload) => {
      if (isAppointmentChangeEvent(event, payload)) runner.schedule();
    });
    return () => {
      unsubscribe();
      runner.dispose();
    };
  }, []);

  // Opening a detail clears its attention dot.
  const openDetail = useCallback(
    (appointment: AppointmentResponse) => {
      setDetail(appointment);
      void getUserProfileApi()
        .then((profile) => markAppointmentNoticeSeen(appointment, role === 'OWNER', profile.id))
        .then((changed) => {
          if (changed) setAttentionVersion((value) => value + 1);
        })
        .catch(() => undefined);
    },
    [role]
  );

  useEffect(() => {
    if (!linkedAppointmentId) return;
    let disposed = false;
    setDetail(null);
    void resolveDeepLink(
      linkedAppointmentId,
      role,
      async () => (await getUserProfileApi()).id
    ).then((result) => {
      if (disposed) return;
      if ('message' in result) {
        consumeRef.current?.();
        showDialog('Thông báo', result.message);
        return;
      }
      if (result.tab) {
        setTab(result.tab);
        setPage(1);
      }
      openDetail(result.appointment);
    });
    return () => {
      disposed = true;
    };
  }, [linkedAppointmentId, role, showDialog, openDetail]);

  const closeDetail = () => {
    setDetail(null);
    onLinkConsumed?.();
  };

  function openDialog(action: OwnerDialogType, appointment: AppointmentResponse) {
    setDialogError(null);
    setDialog({ action, appointment });
  }

  const replaceDetail = (updated: AppointmentResponse) =>
    setDetail((value) => (value && value.id === updated?.id ? updated : value));

  // Actions without a dialog: ignore a second tap while the first is running.
  const running = useRef(new Set<string>());
  async function runNow(action: ServerAction, appointment: AppointmentResponse) {
    if (running.current.has(appointment.id)) return;
    running.current.add(appointment.id);
    const messages = getActionMessages(role, action);
    try {
      replaceDetail(await runAppointmentAction(role, action, appointment.id));
      showDialog('Thông báo', messages.success, undefined, 'success');
      reload();
    } catch (cause) {
      showDialog('Thông báo', serverMessage(cause, messages.failure));
    } finally {
      running.current.delete(appointment.id);
    }
  }

  const submitting = useRef(false);
  async function submitDialog(input: string) {
    if (!dialog || submitting.current) return;
    const { action, appointment } = dialog;
    // The renter's cancel reason is optional.
    const invalid = role === 'OWNER' ? validateOwnerDialog(action, input) : null;
    if (invalid) {
      setDialogError(invalid);
      return;
    }
    submitting.current = true;
    setDialogBusy(true);
    setDialogError(null);
    const messages = getActionMessages(role, action);
    try {
      replaceDetail(await runAppointmentAction(role, action, appointment.id, input));
      setDialog(null);
      showDialog('Thông báo', messages.success, undefined, 'success');
      reload();
    } catch (cause) {
      setDialogError(serverMessage(cause, messages.failure));
    } finally {
      submitting.current = false;
      setDialogBusy(false);
    }
  }

  function handleDetailAction(action: AppointmentAction, appointment: AppointmentResponse) {
    closeDetail();
    if (action === 'request-reschedule') setRescheduleTarget(appointment);
    else if (action === 'complete' || action === 'approve-reschedule')
      void runNow(action, appointment);
    else openDialog(action, appointment);
  }

  const overlayOpen = Boolean(detail || dialog);
  // ScreenHeader also owns the Android back button, so it closes the top layer first.
  const handleBack = () => {
    if (dialog) {
      if (!dialogBusy) setDialog(null);
    } else if (detail) closeDetail();
    else onBack();
  };

  const shown = data?.key === key ? data : null;
  const changeDate = (value?: string) => {
    setDate(value);
    setPage(1);
  };

  function renderContent() {
    if (!shown)
      return loading ? (
        <View className="items-center gap-3 py-16">
          <ActivityIndicator size="large" className="text-primary" />
          <Text className="text-center text-xs text-muted-foreground">
            {tab === 'CALENDAR' ? copy.loadingCalendar : copy.loadingList}
          </Text>
        </View>
      ) : null;
    if (tab === 'CALENDAR')
      return (
        <AppointmentCalendar
          appointments={shown.rows}
          viewRole={role}
          state={calendar}
          onChange={setCalendar}
          onSelectAppointment={openDetail}
        />
      );
    if (!shown.rows.length)
      return (
        <View className="items-center gap-3 rounded-3xl border border-border bg-surface px-5 py-10">
          <Icon name="calendar-outline" size={48} className="text-subtle" />
          <Text className="text-center text-sm font-bold text-foreground">{copy.emptyTitle}</Text>
          <Text className="text-center text-xs leading-5 text-muted-foreground">
            {date ? copy.emptyFiltered : copy.emptyAll}
          </Text>
          <View className="flex-row flex-wrap justify-center gap-3">
            {date ? (
              <Pressable
                onPress={() => changeDate(undefined)}
                accessibilityRole="button"
                className={`min-h-11 justify-center rounded-xl px-4 ${role === 'OWNER' ? 'bg-primary-soft' : 'bg-muted'}`}>
                <Text
                  className={`text-xs font-bold ${role === 'OWNER' ? 'text-primary' : 'text-foreground'}`}>
                  Xem tất cả ngày
                </Text>
              </Pressable>
            ) : null}
            {role === 'RENTER' ? (
              <Pressable
                onPress={() => onSelectTab('search')}
                accessibilityRole="button"
                className="min-h-11 justify-center rounded-xl bg-brand px-4">
                <Text className="text-xs font-bold text-on-brand">Khám phá nhà thuê</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
    return shown.rows.map((appointment) => (
      <AppointmentCard
        key={appointment.id}
        appointment={appointment}
        viewRole={role}
        manageLock={manageGate.title}
        onViewDetail={openDetail}
        onQuickApprove={(item) => openDialog('approve', item)}
      />
    ));
  }

  const ownerCopy = dialog && role === 'OWNER' ? OWNER_ACTION_DIALOGS[dialog.action] : null;

  return (
    <View className="flex-1">
      <SafeAreaView
        className="flex-1 bg-background"
        edges={['top', 'bottom']}
        accessibilityElementsHidden={overlayOpen}
        importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}>
        <ScreenHeader title={copy.title} onBack={handleBack} />
        <ScrollView
          contentContainerClassName="px-4 pb-8 pt-4"
          refreshControl={
            <RefreshControl refreshing={loading && Boolean(shown)} onRefresh={reload} />
          }>
          <Text className="text-xs leading-5 text-muted-foreground">{copy.subtitle}</Text>
          <Pressable
            onPress={reload}
            disabled={loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading, busy: loading }}
            className="mt-3 min-h-11 flex-row items-center gap-2 self-start rounded-xl border border-border bg-surface px-3">
            {loading ? (
              <ActivityIndicator size="small" className="text-primary" />
            ) : (
              <Icon name="refresh-outline" size={15} className="text-muted-foreground" />
            )}
            <Text className="text-xs font-semibold text-muted-foreground">Làm mới</Text>
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityRole="tablist"
            className="my-4 border-b border-border">
            {STATUS_TABS.map((item) => {
              const active = tab === item.value;
              const pending = item.value === 'PENDING' ? (counts.PENDING ?? 0) : 0;
              const count = counts[item.value] ?? 0;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    setTab(item.value);
                    setPage(1);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={[
                    item.label,
                    role === 'OWNER' ? String(count) : '',
                    pending > 0 ? `${pending} lịch đang chờ xác nhận` : '',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  className={`min-h-11 flex-row items-center gap-2 border-b-2 px-3 ${active ? 'border-primary bg-primary-soft' : 'border-surface/0'}`}>
                  <Text
                    className={`text-xs ${active ? 'font-bold text-primary' : 'font-semibold text-muted-foreground'}`}>
                    {item.label}
                  </Text>
                  {pending > 0 ? <View className="h-2 w-2 rounded-full bg-danger-solid" /> : null}
                  {role === 'OWNER' ? (
                    <Text
                      className={`overflow-hidden rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-brand text-on-brand' : 'bg-muted text-muted-foreground'}`}>
                      {count}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {tab !== 'CALENDAR' ? (
            <AppointmentDateFilter selectedDate={date} onSelectDate={changeDate} />
          ) : null}

          <ErrorNotice message={error} />
          {error ? (
            <View className="mb-3">
              <Button label="Thử lại" onPress={reload} disabled={loading} />
            </View>
          ) : null}

          {renderContent()}

          {tab !== 'CALENDAR' && shown ? (
            <PageBar
              page={page}
              totalPages={shown.totalPages}
              totalItems={shown.total}
              pageSize={LIST_PAGE_SIZE}
              shown={shown.rows.length}
              disabled={loading}
              onChange={setPage}
              summary={`Tổng cộng: ${shown.total} lịch hẹn · ${page} / ${shown.totalPages}`}
              nextLabel="Sau"
            />
          ) : null}
        </ScrollView>
        <BottomTabBar
          active="management"
          onSelect={onSelectTab}
          attentionVersion={attentionVersion}
        />
      </SafeAreaView>

      {detail ? (
        <AppointmentDetailModal
          appointment={detail}
          viewRole={role}
          manageLock={manageGate.title}
          bookLock={bookGate.title}
          onClose={closeDetail}
          onOpenListing={onOpenListing}
          onAction={handleDetailAction}
        />
      ) : null}

      {dialog ? (
        <ActionDialog
          key={`${dialog.action}-${dialog.appointment.id}`}
          title={ownerCopy?.title ?? 'Hủy lịch xem nhà'}
          message={
            ownerCopy ? (
              ownerCopy.message
            ) : (
              <>
                Bạn có chắc chắn muốn hủy lịch hẹn xem nhà cho bài đăng{' '}
                <Text className="font-bold text-foreground">{dialog.appointment.listingTitle}</Text>
                ?
              </>
            )
          }
          placeholder={
            ownerCopy?.placeholder ??
            'Nhập lý do hủy lịch (ví dụ: bận đột xuất, đã tìm được nhà khác...)'
          }
          confirmLabel={ownerCopy ? 'Xác nhận' : 'Xác nhận hủy lịch'}
          busyLabel={ownerCopy ? 'Đang xử lý...' : 'Đang hủy...'}
          danger={dialog.action !== 'approve'}
          busy={dialogBusy}
          error={dialogError}
          onBack={() => setDialog(null)}
          onConfirm={(input) => void submitDialog(input)}
        />
      ) : null}

      {rescheduleTarget ? (
        <BookingAppointmentModal
          isOpen
          onClose={() => {
            setRescheduleTarget(null);
            void loadRef.current();
          }}
          listingId={rescheduleTarget.listingId}
          listingTitle={rescheduleTarget.listingTitle}
          listingAddress={rescheduleTarget.listingAddress}
          listingPrice={rescheduleTarget.listingPrice ?? undefined}
          listingThumbnail={rescheduleTarget.listingThumbnail}
          ownerId={rescheduleTarget.ownerId}
        />
      ) : null}
    </View>
  );
}
