import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { calendarDays, dateKey, moveCalendar, type CalendarView } from '@/lib/appointment-calendar';
import { statusLabel, type ManagementEntry } from '@/services/managementApi';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export type CalendarState = { view: CalendarView; anchor: Date; selected: string };

export default function AppointmentCalendar({
  rows,
  owner,
  loading,
  onSelect,
  state,
  onChange,
}: {
  rows: ManagementEntry[];
  owner: boolean;
  loading: boolean;
  onSelect: (entry: ManagementEntry) => void;
  state: CalendarState;
  onChange: (value: CalendarState) => void;
}) {
  const { view, anchor, selected } = state;
  const days = calendarDays(anchor, view);
  const today = dateKey(new Date());
  const grouped = useMemo(() => {
    const result = new Map<string, ManagementEntry[]>();
    rows.forEach((row) => {
      if (!row.appointment) return;
      const key = row.appointment.appointmentDate;
      result.set(key, [...(result.get(key) ?? []), row]);
    });
    result.forEach((items) =>
      items.sort((a, b) => a.appointment!.startTime.localeCompare(b.appointment!.startTime))
    );
    return result;
  }, [rows]);
  const selectedRows = grouped.get(selected) ?? [];
  function navigate(amount: number) {
    const next = moveCalendar(anchor, view, amount);
    onChange({ ...state, anchor: next, selected: dateKey(next) });
  }
  return (
    <View>
      <View className="overflow-hidden rounded-2xl border border-border bg-surface">
        <View className="border-b border-border p-3">
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={view === 'month' ? 'Tháng trước' : 'Tuần trước'}
              onPress={() => navigate(-1)}
              className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Icon name="chevron-back" size={20} className="text-foreground" />
            </Pressable>
            <Text className="font-bold text-foreground">
              {view === 'month'
                ? `Tháng ${anchor.getMonth() + 1}/${anchor.getFullYear()}`
                : `${days[0].getDate()}/${days[0].getMonth() + 1} – ${days[6].getDate()}/${days[6].getMonth() + 1}/${days[6].getFullYear()}`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={view === 'month' ? 'Tháng sau' : 'Tuần sau'}
              onPress={() => navigate(1)}
              className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Icon name="chevron-forward" size={20} className="text-foreground" />
            </Pressable>
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const now = new Date();
                onChange({ ...state, anchor: now, selected: dateKey(now) });
              }}
              className="min-h-11 justify-center rounded-xl border border-border px-3">
              <Text className="text-xs font-semibold text-foreground">Hôm nay</Text>
            </Pressable>
            <View className="flex-row rounded-xl bg-muted p-1">
              {(['month', 'week'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: view === option }}
                  onPress={() =>
                    onChange({ ...state, view: option, anchor: new Date(`${selected}T00:00:00`) })
                  }
                  className={`min-h-10 justify-center rounded-lg px-4 ${view === option ? 'bg-surface' : ''}`}>
                  <Text
                    className={
                      view === option
                        ? 'text-xs font-bold text-primary'
                        : 'text-xs font-semibold text-secondary'
                    }>
                    {option === 'month' ? 'Tháng' : 'Tuần'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <View className="flex-row bg-muted py-3">
          {WEEKDAYS.map((day) => (
            <Text key={day} className="flex-1 text-center text-xs font-bold text-muted-foreground">
              {day}
            </Text>
          ))}
        </View>
        <View>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <View key={dateKey(days[week * 7])} className="flex-row">
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const key = dateKey(day);
                const items = grouped.get(key) ?? [];
                const active = key === selected;
                const outside = view === 'month' && day.getMonth() !== anchor.getMonth();
                return (
                  <Pressable
                    key={key}
                    onPress={() =>
                      onChange({ ...state, selected: key, anchor: outside ? day : anchor })
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${day.getDate()}/${day.getMonth() + 1}/${day.getFullYear()}${key === today ? ', hôm nay' : ''}, ${loading ? 'đang tải lịch' : `${items.length} lịch hẹn`}`}
                    className={`min-h-16 flex-1 items-center justify-center border-b border-border py-2 ${active ? 'bg-primary-soft' : outside ? 'bg-muted' : 'bg-surface'}`}>
                    <View
                      className={`h-7 w-7 items-center justify-center rounded-full ${key === today ? 'bg-brand' : ''}`}>
                      <Text
                        className={
                          key === today
                            ? 'text-xs font-bold text-on-brand'
                            : active
                              ? 'text-xs font-bold text-primary'
                              : outside
                                ? 'text-xs text-subtle'
                                : 'text-xs font-semibold text-foreground'
                        }>
                        {day.getDate()}
                      </Text>
                    </View>
                    <View className="mt-1 h-4 flex-row items-center gap-1">
                      {items.length ? (
                        <>
                          <View
                            className={`h-1.5 w-1.5 rounded-full ${items.some((item) => item.status === 'CONFIRMED') ? 'bg-primary' : 'bg-success'}`}
                          />
                          <Text className="text-[10px] font-semibold text-secondary">
                            {items.length}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <Text className="px-3 py-3 text-xs leading-5 text-muted-foreground">
          Lịch hiển thị hẹn đã xác nhận và đã hoàn thành. Chạm một ngày để xem chi tiết bên dưới.
        </Text>
      </View>
      <View className="mb-3 mt-5 flex-row items-center justify-between">
        <Text className="font-bold text-foreground">
          Ngày {selected.split('-').reverse().join('/')}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {loading ? 'Đang tải...' : `${selectedRows.length} lịch hẹn`}
        </Text>
      </View>
      {!loading && !selectedRows.length ? (
        <Text className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          Không có lịch đã xác nhận hoặc hoàn thành trong ngày này.
        </Text>
      ) : null}
      {selectedRows.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => onSelect(row)}
          accessibilityRole="button"
          className="mb-3 rounded-2xl border border-border bg-surface p-4">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <Icon name="time-outline" size={16} className="text-primary" />
              <Text className="font-bold text-primary">
                {row.appointment!.startTime.slice(0, 5)}–{row.appointment!.endTime.slice(0, 5)}
              </Text>
            </View>
            <Text
              className={
                row.status === 'COMPLETED'
                  ? 'text-xs font-semibold text-success'
                  : 'text-xs font-semibold text-primary'
              }>
              {statusLabel(row.status)}
            </Text>
          </View>
          <Text className="mt-2 font-bold text-foreground">{row.title}</Text>
          <Text className="mt-2 text-xs leading-5 text-muted-foreground">
            {row.appointment!.listingAddress}
          </Text>
          {owner ? (
            <Text className="mt-2 text-xs font-semibold text-secondary">
              Người xem: {row.appointment!.renterName}
            </Text>
          ) : null}
          {row.appointment!.rescheduleRequested ? (
            <Text className="mt-2 text-xs font-semibold text-warning">Có đề xuất đổi lịch</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
