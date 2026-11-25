import { useCallback } from 'react';
import { Text, View } from 'react-native';

import AppCalendar from '@/components/appointment/AppCalendar';
import StepHeading from '@/components/appointment/booking/StepHeading';
import Icon from '@/components/Icon';
import { formatAllowedDays, formatLongDate, isViewingDayDisabled } from '@/lib/appointment';

export default function DateStep({
  date,
  allowedDays,
  onSelect,
}: {
  date: Date;
  allowedDays: string[] | undefined;
  onSelect: (date: Date) => void;
}) {
  const isDisabled = useCallback(
    (day: Date) => isViewingDayDisabled(day, allowedDays),
    [allowedDays]
  );
  return (
    <View className="gap-3">
      <View className="gap-1">
        <StepHeading icon="calendar-outline" title="1. Chọn ngày xem nhà" required />
        <Text className="text-xs text-muted-foreground">
          Chủ nhà tiếp khách vào:{' '}
          <Text className="font-bold text-foreground">{formatAllowedDays(allowedDays)}</Text>
        </Text>
      </View>
      <View className="rounded-2xl border border-border bg-surface p-2">
        <AppCalendar selected={date} onSelect={onSelect} disabled={isDisabled} />
        <View className="mt-2 flex-row flex-wrap items-center justify-between gap-1 border-t border-border px-2 pb-1 pt-2.5">
          <Text className="text-xs text-muted-foreground">Ngày đã chọn:</Text>
          <View className="flex-row items-center gap-1.5">
            <Icon name="calendar-outline" size={16} className="text-primary" />
            <Text className="text-xs font-bold text-primary">{formatLongDate(date)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
