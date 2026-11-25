// Port of hs-web-app components/appointment/AppointmentCalendar.tsx: the same wide 7-column grid,
// scrolled sideways on phones. View and anchor are lifted so they survive reloads.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { isSameMonth } from 'date-fns';

import Icon from '@/components/Icon';
import {
  CALENDAR_WEEKDAY_LABELS,
  formatDateLabel,
  formatTime,
  getAppointmentCalendarDays,
  getCalendarTitle,
  groupAppointmentsByDate,
  shiftCalendar,
  toDateKey,
  type CalendarView,
} from '@/lib/appointment';
import type { AppointmentResponse, AppointmentViewRole } from '@/types/appointment';

const MIN_GRID_WIDTH = 840;

export type CalendarState = { view: CalendarView; anchor: Date };

function CalendarEvent({
  appointment,
  view,
  viewRole,
  onPress,
}: {
  appointment: AppointmentResponse;
  view: CalendarView;
  viewRole: AppointmentViewRole;
  onPress: () => void;
}) {
  const completed = appointment.status === 'COMPLETED';
  const accent = completed ? 'text-success' : 'text-primary';
  const box = completed
    ? 'border-success bg-success-soft'
    : 'border-primary-border bg-primary-soft';
  const label = [
    formatDateLabel(appointment.appointmentDate),
    formatTime(appointment.startTime),
    appointment.listingTitle,
    viewRole === 'OWNER' ? appointment.renterName : '',
    completed ? 'Đã xem xong' : '',
  ]
    .filter(Boolean)
    .join(' — ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`rounded-lg border ${box} ${view === 'month' ? 'min-h-8 flex-row items-center gap-1 px-1 py-1' : 'gap-1.5 p-2'}`}>
      {view === 'month' ? (
        <>
          <Icon name="time-outline" size={10} className={accent} />
          <Text className={`text-[9px] font-black ${accent}`}>
            {formatTime(appointment.startTime)}
          </Text>
          <Icon name="business-outline" size={10} className="text-muted-foreground" />
          <Text numberOfLines={1} className="min-w-0 flex-1 text-[10px] font-bold text-foreground">
            {appointment.listingTitle}
          </Text>
          {completed ? <Icon name="checkmark-circle" size={14} className="text-success" /> : null}
        </>
      ) : (
        <>
          <View className="flex-row flex-wrap items-center gap-1">
            <Icon name="time-outline" size={12} className={accent} />
            <Text className={`text-[10px] font-black ${accent}`}>
              {formatTime(appointment.startTime)}–{formatTime(appointment.endTime)}
            </Text>
          </View>
          {completed ? (
            <View className="flex-row items-center gap-1 self-end">
              <Icon name="checkmark-circle" size={16} className="text-success" />
              <Text className="text-[9px] font-bold text-success">Done</Text>
            </View>
          ) : null}
          <View className="flex-row gap-1">
            <Icon name="business-outline" size={12} className="mt-0.5 text-primary" />
            <Text className="flex-1 text-xs font-bold leading-4 text-foreground">
              {appointment.listingTitle}
            </Text>
          </View>
          {appointment.listingAddress ? (
            <View className="flex-row gap-1">
              <Icon name="location-outline" size={10} className="mt-0.5 text-muted-foreground" />
              <Text className="flex-1 text-[10px] text-muted-foreground">
                {appointment.listingAddress}
              </Text>
            </View>
          ) : null}
          {viewRole === 'OWNER' ? (
            <View className="flex-row gap-1">
              <Icon name="person-outline" size={10} className="mt-0.5 text-secondary" />
              <Text className="flex-1 text-[10px] font-semibold text-secondary">
                {appointment.renterName} · {appointment.visitorCount} người
              </Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export default function AppointmentCalendar({
  appointments,
  viewRole,
  state,
  onChange,
  onSelectAppointment,
}: {
  appointments: AppointmentResponse[];
  viewRole: AppointmentViewRole;
  state: CalendarState;
  onChange: (state: CalendarState) => void;
  onSelectAppointment: (appointment: AppointmentResponse) => void;
}) {
  const { view, anchor } = state;
  const [width, setWidth] = useState(0);
  const days = getAppointmentCalendarDays(anchor, view);
  const grouped = useMemo(() => groupAppointmentsByDate(appointments), [appointments]);
  const today = toDateKey(new Date());
  const move = (amount: number) => onChange({ view, anchor: shiftCalendar(anchor, view, amount) });
  const arrow = 'h-11 w-11 items-center justify-center rounded-xl border border-border';

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="overflow-hidden rounded-3xl border border-border bg-surface">
      <View className="gap-3 border-b border-border p-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Pressable
            onPress={() => move(-1)}
            accessibilityRole="button"
            accessibilityLabel={view === 'month' ? 'Tháng trước' : 'Tuần trước'}
            className={arrow}>
            <Icon name="chevron-back" size={18} className="text-muted-foreground" />
          </Pressable>
          <Pressable
            onPress={() => onChange({ view, anchor: new Date() })}
            accessibilityRole="button"
            className="min-h-11 justify-center rounded-xl border border-border px-3">
            <Text className="text-xs font-bold text-foreground">Hôm nay</Text>
          </Pressable>
          <Pressable
            onPress={() => move(1)}
            accessibilityRole="button"
            accessibilityLabel={view === 'month' ? 'Tháng sau' : 'Tuần sau'}
            className={arrow}>
            <Icon name="chevron-forward" size={18} className="text-muted-foreground" />
          </Pressable>
          <Text accessibilityRole="header" className="ml-1 text-sm font-bold text-foreground">
            {getCalendarTitle(anchor, view)}
          </Text>
        </View>
        <View className="flex-row self-start rounded-xl bg-muted p-1" accessibilityRole="tablist">
          {(['month', 'week'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => onChange({ view: option, anchor })}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === option }}
              className={`min-h-10 justify-center rounded-lg px-4 ${view === option ? 'bg-surface' : ''}`}>
              <Text
                className={`text-xs ${view === option ? 'font-bold text-primary' : 'font-semibold text-muted-foreground'}`}>
                {option === 'month' ? 'Tháng' : 'Tuần'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView horizontal nestedScrollEnabled>
        <View style={{ width: Math.max(MIN_GRID_WIDTH, width - 2) }}>
          <View className="flex-row border-b border-border bg-muted">
            {CALENDAR_WEEKDAY_LABELS.map((day) => (
              <Text
                key={day}
                className="flex-1 border-r border-border px-2 py-2 text-center text-[11px] font-bold uppercase text-muted-foreground">
                {day}
              </Text>
            ))}
          </View>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <View key={toDateKey(days[week * 7]!)} className="flex-row">
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const key = toDateKey(day);
                const items = grouped.get(key) ?? [];
                const outside = view === 'month' && !isSameMonth(day, anchor);
                const isToday = key === today;
                return (
                  <View
                    key={key}
                    className={`flex-1 ${view === 'month' ? 'min-h-32 p-1.5' : 'min-h-[480px] p-2'} ${
                      isToday
                        ? 'border-2 border-primary bg-primary-soft'
                        : `border-b border-r border-border ${outside ? 'bg-muted' : 'bg-surface'}`
                    }`}>
                    <View className="mb-1 flex-row items-center justify-between">
                      <View
                        className={`h-7 min-w-7 items-center justify-center rounded-full px-1 ${isToday ? 'bg-brand' : ''}`}>
                        <Text
                          className={`text-xs font-bold ${isToday ? 'text-on-brand' : outside ? 'text-muted-foreground opacity-50' : 'text-foreground'}`}>
                          {day.getDate()}
                        </Text>
                      </View>
                      <View className="shrink flex-row items-center gap-1">
                        {isToday ? (
                          <Text className="overflow-hidden rounded-full border border-primary-border bg-surface px-1 py-0.5 text-[9px] font-black uppercase text-primary">
                            Hôm nay
                          </Text>
                        ) : null}
                        {items.length > 0 ? (
                          <Text className="text-[10px] font-semibold text-muted-foreground">
                            {items.length} lịch
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View className="gap-1">
                      {items.map((appointment) => (
                        <CalendarEvent
                          key={appointment.id}
                          appointment={appointment}
                          view={view}
                          viewRole={viewRole}
                          onPress={() => onSelectAppointment(appointment)}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {appointments.length === 0 ? (
        <View className="items-center gap-2 border-t border-border px-4 py-8">
          <Icon name="calendar-outline" size={36} className="text-subtle" />
          <Text className="text-center text-sm font-bold text-foreground">
            Chưa có lịch xem nhà trong calendar
          </Text>
          <Text className="text-center text-xs text-muted-foreground">
            Lịch đã xác nhận và đã xem xong sẽ xuất hiện tại đây.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
