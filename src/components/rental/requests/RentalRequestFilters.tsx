// hs-web-app components/rental-request/RentalRequestFilters.tsx: status chips, scrolled sideways.
import { Pressable, ScrollView, Text } from 'react-native';

import type { RequestFilter } from '@/lib/rental/useRentalRequestList';

import { STATUS_FILTERS } from './logic';

export default function RentalRequestFilters({
  value,
  onChange,
}: {
  value: RequestFilter;
  onChange: (filter: RequestFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Lọc theo trạng thái"
      className="-mx-4"
      contentContainerClassName="gap-2 px-4">
      {STATUS_FILTERS.map((tab) => {
        const selected = value === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-11 justify-center rounded-full border px-4 active:opacity-80 ${selected ? 'border-brand bg-brand' : 'border-border bg-surface'}`}>
            <Text
              className={`text-sm font-semibold ${selected ? 'text-on-brand' : 'text-muted-foreground'}`}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
