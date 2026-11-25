// Port of hs-web-app components/appointment/AppointmentDateFilter.tsx. The web popover opens inline.
import { useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import AppCalendar from '@/components/appointment/AppCalendar';
import Icon from '@/components/Icon';
import { getDateFilterState, toDateKey } from '@/lib/appointment';

function Chip({
  label,
  active,
  icon,
  expanded,
  onPress,
}: {
  label: string;
  active: boolean;
  icon?: ComponentProps<typeof Icon>['name'];
  expanded?: boolean;
  onPress: () => void;
}) {
  const text = active ? 'text-on-brand' : 'text-muted-foreground';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active, expanded }}
      className={`min-h-11 flex-row items-center gap-1.5 rounded-xl px-3 ${active ? 'bg-brand' : 'border border-border'}`}>
      {icon ? <Icon name={icon} size={14} className={text} /> : null}
      <Text className={`text-xs ${active ? 'font-bold' : 'font-semibold'} ${text}`}>{label}</Text>
    </Pressable>
  );
}

export default function AppointmentDateFilter({
  selectedDate,
  onSelectDate,
}: {
  selectedDate?: string;
  onSelectDate: (date?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const state = getDateFilterState(selectedDate);
  const select = (date?: string) => {
    onSelectDate(date);
    setOpen(false);
  };
  return (
    <View className="mb-4 gap-2 rounded-2xl border border-border bg-surface p-2.5">
      <View className="flex-row flex-wrap gap-1.5">
        <Chip label="Tất cả ngày" active={state.isAll} onPress={() => select(undefined)} />
        <Chip label="Hôm nay" active={state.isToday} onPress={() => select(state.todayKey)} />
        <Chip
          label="Ngày mai"
          active={state.isTomorrow}
          onPress={() => select(state.tomorrowKey)}
        />
        <Chip
          label={state.customButtonLabel}
          icon="calendar-outline"
          active={state.isCustom}
          expanded={open}
          onPress={() => setOpen((value) => !value)}
        />
      </View>
      {open ? (
        <View className="rounded-2xl border border-border p-3">
          <View className="mb-2 flex-row items-center justify-between gap-2">
            <Text className="text-xs font-bold text-foreground">Chọn ngày xem nhà:</Text>
            {selectedDate ? (
              <Pressable onPress={() => select(undefined)} accessibilityRole="button" hitSlop={12}>
                <Text className="text-xs text-muted-foreground">Xóa chọn</Text>
              </Pressable>
            ) : null}
          </View>
          <AppCalendar
            selected={state.date}
            // Tapping the selected day again clears it, like react-day-picker.
            onSelect={(date) => {
              const key = toDateKey(date);
              select(key === selectedDate ? undefined : key);
            }}
          />
        </View>
      ) : null}
      {selectedDate ? (
        <View className="flex-row items-center gap-2 self-start rounded-xl bg-primary-soft py-1 pl-3 pr-1">
          <Icon name="calendar-outline" size={14} className="text-primary" />
          <Text className="shrink text-xs font-semibold text-primary">{state.summary}</Text>
          <Pressable
            onPress={() => select(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Xóa bộ lọc ngày"
            className="h-9 w-9 items-center justify-center rounded-full">
            <Icon name="close" size={14} className="text-primary" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
