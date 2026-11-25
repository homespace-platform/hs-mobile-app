// Mobile counterpart of hs-web-app components/ui/calendar.tsx (react-day-picker, `vi` locale).
import { useCallback, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import DateTimePicker, { type CalendarComponents, type DateType } from 'react-native-ui-datepicker';
import { format, startOfDay } from 'date-fns';
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
  Weekday: ({ index }) => (
    <Text className="text-xs font-bold uppercase text-muted-foreground">
      {format(new Date(2026, 1, 1 + index), 'cccccc', { locale: vi })}
    </Text>
  ),
};

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
}: {
  selected?: Date;
  /** Also called when the selected day is tapped again (web react-day-picker would deselect). */
  onSelect: (date: Date) => void;
  disabled?: (date: Date) => boolean;
  minDate?: Date;
}) {
  // The picker memoises its press handler and keeps the first onChange, so route it through a ref.
  const latestOnSelect = useRef(onSelect);
  latestOnSelect.current = onSelect;
  const handleChange = useCallback(({ date }: { date: DateType }) => {
    if (date) latestOnSelect.current(toDate(date));
  }, []);
  const isDisabled = useCallback((date: DateType) => disabled?.(toDate(date)) ?? false, [disabled]);

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
        date={useStableDate(selected)}
        minDate={useStableDate(minDate && startOfDay(minDate))}
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
