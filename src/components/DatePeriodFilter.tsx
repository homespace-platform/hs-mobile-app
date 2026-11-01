import { Pressable, ScrollView, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import {
  datePeriodLabel,
  getDatePeriodRange,
  moveDatePeriod,
  type DatePeriod,
} from '@/lib/date-period';

const OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'DAY', label: 'Ngày' },
  { value: 'WEEK', label: 'Tuần' },
  { value: 'MONTH', label: 'Tháng' },
];

export default function DatePeriodFilter({
  period,
  anchor,
  onPeriodChange,
  onAnchorChange,
}: {
  period: DatePeriod;
  anchor: Date;
  onPeriodChange: (period: DatePeriod) => void;
  onAnchorChange: (date: Date) => void;
}) {
  const range = getDatePeriodRange(anchor, period);
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-semibold text-muted-foreground">Lọc theo thời gian</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {OPTIONS.map((option) => {
          const selected = period === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onPeriodChange(option.value)}
              className={`mr-2 min-h-10 items-center justify-center rounded-full border px-4 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
              <Text
                className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-secondary'}`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {range ? (
        <View className="mt-2 min-h-11 flex-row items-center justify-between rounded-xl bg-muted px-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Khoảng thời gian trước"
            onPress={() =>
              onAnchorChange(moveDatePeriod(anchor, period as Exclude<DatePeriod, 'ALL'>, -1))
            }
            className="min-h-10 min-w-10 items-center justify-center">
            <Icon name="chevron-back" size={20} className="text-secondary" />
          </Pressable>
          <Text className="flex-1 text-center text-sm font-semibold text-foreground">
            {datePeriodLabel(range.start, range.end, period as Exclude<DatePeriod, 'ALL'>)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Khoảng thời gian tiếp theo"
            onPress={() =>
              onAnchorChange(moveDatePeriod(anchor, period as Exclude<DatePeriod, 'ALL'>, 1))
            }
            className="min-h-10 min-w-10 items-center justify-center">
            <Icon name="chevron-forward" size={20} className="text-secondary" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
