// Mobile counterpart of hs-web-app components/ui/calendar.tsx (react-day-picker, `vi` locale).
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DateTimePicker, { type CalendarComponents, type DateType } from 'react-native-ui-datepicker';
import {
  addDays,
  addMonths,
  format,
  getDay,
  getDaysInMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { vi } from 'date-fns/locale/vi';

import Icon from '@/components/Icon';

const DAY = 38;
const WEEKDAYS_HEIGHT = 28;
// Layout only; every color comes from the semantic classNames below.
const LAYOUT = {
  day_cell: { alignItems: 'center', justifyContent: 'center' },
  day: { flex: 0, width: 36, height: 36, borderRadius: 12 },
} as const;

const CLASS_NAMES = {
  header: 'mb-1',
  button_prev: 'h-9 w-9 items-center justify-center',
  button_next: 'h-9 w-9 items-center justify-center',
  day_label: 'text-[13px] font-semibold text-foreground',
  today_label: 'text-primary',
  outside_label: 'text-muted-foreground',
  selected: 'bg-brand',
  selected_label: 'font-bold text-on-brand',
  disabled: 'opacity-25',
};

const toDate = (value: DateType) => new Date(value!.valueOf() as number | string);
const CAPTION = 'text-[15px] font-bold capitalize text-foreground';

function weekdayLabel(index: number) {
  return (
    <Text className="text-xs font-bold uppercase text-muted-foreground">
      {format(new Date(2026, 1, 1 + index), 'cccccc', { locale: vi })}
    </Text>
  );
}

const COMPONENTS: CalendarComponents = {
  IconPrev: <Icon name="chevron-back" size={20} className="text-primary" />,
  IconNext: <Icon name="chevron-forward" size={20} className="text-primary" />,
  // The library writes "tháng 11"; web's caption is date-fns "Tháng Mười Một 2026".
  MonthSelector: ({ text }) => (
    <Text accessibilityRole="header" className={CAPTION}>
      {format(new Date(2000, Number(text.replace(/\D/g, '')) - 1, 1), 'LLLL', { locale: vi })}
    </Text>
  ),
  YearSelector: ({ year }) => <Text className={CAPTION}>{year}</Text>,
  // 1 Feb 2026 is a Sunday, matching weekday index 0.
  Weekday: ({ index }) => weekdayLabel(index),
};

function MonthArrow({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`h-11 w-11 items-center justify-center ${disabled ? 'opacity-25' : ''}`}>
      <Icon name={icon} size={20} className="text-primary" />
    </Pressable>
  );
}

/** The picker resets its visible month whenever a date prop changes identity. */
function useStableDate(date: Date | undefined) {
  const time = date?.getTime();
  return useMemo(() => (time === undefined ? undefined : new Date(time)), [time]);
}

export default function AppCalendar({
  selected,
  onSelect,
  disabled,
  minDate,
  range,
}: {
  selected?: Date;
  /** Also called when the selected day is tapped again (web react-day-picker would deselect). */
  onSelect: (date: Date) => void;
  disabled?: (date: Date) => boolean;
  minDate?: Date;
  /**
   * First and last date that can be picked. Highlights the enabled days, hides days outside the
   * month, opens on the month of `selected` (else `start`) and keeps navigation inside the range.
   */
  range?: { start: Date; end: Date };
}) {
  // The picker memoises its press handler and keeps the first onChange, so route it through a ref.
  const latestOnSelect = useRef(onSelect);
  latestOnSelect.current = onSelect;
  const handleChange = useCallback(({ date }: { date: DateType }) => {
    if (date) latestOnSelect.current(toDate(date));
  }, []);
  const isDisabled = useCallback((date: DateType) => disabled?.(toDate(date)) ?? false, [disabled]);
  const selectedDate = useStableDate(selected);
  const minimum = useStableDate(minDate && startOfDay(minDate));
  const [browsed, setBrowsed] = useState(() =>
    startOfMonth(selected ?? range?.start ?? new Date())
  );
  if (range) {
    const first = startOfMonth(range.start);
    const last = startOfMonth(range.end);
    const month = browsed < first ? first : browsed > last ? last : browsed;
    const lead = (getDay(month) + 6) % 7;
    const days = getDaysInMonth(month);
    const start = startOfDay(range.start);
    const end = startOfDay(range.end);
    return (
      <View className="w-full max-w-[320px] self-center">
        <View className="flex-row items-center">
          <Text accessibilityRole="header" className={`flex-1 ${CAPTION}`}>
            {format(month, 'LLLL yyyy', { locale: vi })}
          </Text>
          <MonthArrow
            icon="chevron-back"
            label="Tháng trước"
            disabled={month <= first}
            onPress={() => setBrowsed(addMonths(month, -1))}
          />
          <MonthArrow
            icon="chevron-forward"
            label="Tháng sau"
            disabled={month >= last}
            onPress={() => setBrowsed(addMonths(month, 1))}
          />
        </View>
        <View className="h-7 flex-row">
          {Array.from({ length: 7 }, (_, column) => (
            <View key={column} className="flex-1 items-center justify-center">
              {weekdayLabel((column + 1) % 7)}
            </View>
          ))}
        </View>
        {/* The picker's month=0 and year effects can disagree. Use the same month for grid and caption. */}
        {Array.from({ length: 6 }, (_, week) => (
          <View key={week} className="h-[38px] flex-row">
            {Array.from({ length: 7 }, (_, column) => {
              const index = week * 7 + column - lead;
              if (index < 0 || index >= days) return <View key={column} className="flex-1" />;
              const date = addDays(month, index);
              const unavailable =
                date < start ||
                date > end ||
                (minimum ? date < minimum : false) ||
                !!disabled?.(date);
              const chosen = !!selected && isSameDay(date, selected);
              return (
                <Pressable
                  key={column}
                  className="flex-1 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={format(date, 'dd/MM/yyyy')}
                  accessibilityState={{ disabled: unavailable, selected: chosen }}
                  disabled={unavailable}
                  onPress={() => onSelect(date)}>
                  <View
                    className={`h-9 w-9 items-center justify-center rounded-xl ${unavailable ? 'opacity-25' : chosen ? 'bg-brand' : 'bg-primary-soft'}`}>
                    <Text
                      className={`text-[13px] font-semibold ${unavailable ? 'text-foreground' : chosen ? 'text-on-brand' : 'text-primary'}`}>
                      {index + 1}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="w-full max-w-[320px] self-center">
      <DateTimePicker
        mode="single"
        locale="vi"
        firstDayOfWeek={1}
        showOutsideDays
        navigationPosition="right"
        disableMonthPicker
        disableYearPicker
        date={selectedDate}
        minDate={minimum}
        disabledDates={isDisabled}
        onChange={handleChange}
        weekdaysHeight={WEEKDAYS_HEIGHT}
        containerHeight={WEEKDAYS_HEIGHT + DAY * 6}
        styles={LAYOUT}
        classNames={CLASS_NAMES}
        components={COMPONENTS}
      />
    </View>
  );
}
