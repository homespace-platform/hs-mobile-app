import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { calendarDays, dateKey, moveCalendar } from '@/lib/appointment-calendar';
import { canSelectViewingDay, VIEWING_DAYS } from '@/lib/booking';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function BookingDatePicker({
  value,
  onChange,
  allowedDays,
  minDate,
  disabled,
  hint = 'Chọn ngày bạn muốn đến xem nhà.',
}: {
  value: string;
  onChange: (value: string) => void;
  allowedDays?: string[];
  minDate: string;
  disabled: boolean;
  hint?: string;
}) {
  const [anchor, setAnchor] = useState(() => new Date(`${value}T00:00:00`));
  const days = calendarDays(anchor, 'month');
  const previous = moveCalendar(anchor, 'month', -1);
  const previousDisabled =
    disabled || dateKey(new Date(previous.getFullYear(), previous.getMonth() + 1, 0)) < minDate;
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-surface p-3">
      <View className="mb-3 flex-row items-center justify-between">
        <Pressable
          disabled={previousDisabled}
          onPress={() => setAnchor(previous)}
          accessibilityRole="button"
          accessibilityLabel="Tháng trước"
          accessibilityState={{ disabled: previousDisabled }}
          className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Icon
            name="chevron-back"
            size={20}
            className={previousDisabled ? 'text-subtle' : 'text-foreground'}
          />
        </Pressable>
        <Text className="text-base font-bold text-foreground">
          Tháng {anchor.getMonth() + 1}, {anchor.getFullYear()}
        </Text>
        <Pressable
          disabled={disabled}
          onPress={() => setAnchor(moveCalendar(anchor, 'month', 1))}
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Icon name="chevron-forward" size={20} className="text-foreground" />
        </Pressable>
      </View>
      <View className="mb-1 flex-row">
        {WEEKDAYS.map((day) => (
          <Text
            key={day}
            className="flex-1 py-2 text-center text-xs font-semibold text-muted-foreground">
            {day}
          </Text>
        ))}
      </View>
      {Array.from({ length: days.length / 7 }, (_, week) => (
        <View key={dateKey(days[week * 7])} className="flex-row">
          {days.slice(week * 7, week * 7 + 7).map((day) => {
            const key = dateKey(day);
            const active = key === value;
            const outside = day.getMonth() !== anchor.getMonth();
            const unavailable = disabled || !canSelectViewingDay(day, minDate, allowedDays);
            return (
              <Pressable
                key={key}
                disabled={unavailable}
                onPress={() => {
                  onChange(key);
                  if (outside) setAnchor(day);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${DAY_LABELS[day.getDay()]}, ${day.getDate()}/${day.getMonth() + 1}/${day.getFullYear()}${key === minDate ? ', hôm nay' : ''}`}
                accessibilityState={{ selected: active, disabled: unavailable }}
                className="min-h-12 flex-1 items-center justify-center py-1">
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full border ${active ? 'border-brand bg-brand' : key === minDate ? 'border-primary-border bg-primary-soft' : 'border-surface bg-surface'}`}>
                  <Text
                    className={
                      active
                        ? 'font-bold text-on-brand'
                        : unavailable || outside
                          ? 'text-sm text-subtle'
                          : 'text-sm font-semibold text-foreground'
                    }>
                    {day.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View className="mt-3 border-t border-border px-1 pt-3">
        <Text className="text-xs leading-5 text-muted-foreground">
          {allowedDays === undefined
            ? hint
            : allowedDays.length
              ? `Chủ nhà nhận xem: ${[1, 2, 3, 4, 5, 6, 0]
                  .map((index) =>
                    allowedDays.includes(VIEWING_DAYS[index]) ? DAY_LABELS[index] : null
                  )
                  .filter(Boolean)
                  .join(', ')}.`
              : 'Chủ nhà chưa mở lịch xem nhà.'}
        </Text>
      </View>
    </View>
  );
}
