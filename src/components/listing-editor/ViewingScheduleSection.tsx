import { View } from 'react-native';

import { Anchor } from '@/components/rental/contract/anchors';
import { toggleValue, VIEWING_DAYS, VIEWING_SLOTS } from '@/lib/listing-form';

import { CheckRow, Chip, ErrorText, FieldLabel, Section, type SectionProps } from './ui';

export default function ViewingScheduleSection({ state, update, errors }: SectionProps) {
  return (
    <Section title="Lịch xem nhà" description="Chọn ít nhất 1 ngày và 1 buổi.">
      <Anchor id="viewingDays" className="gap-2">
        <FieldLabel text="Ngày trong tuần *" />
        <View className="flex-row flex-wrap gap-2">
          {VIEWING_DAYS.map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={state.selectedViewingDays.includes(value)}
              onPress={() =>
                update((s) => ({
                  ...s,
                  selectedViewingDays: toggleValue(s.selectedViewingDays, value),
                }))
              }
            />
          ))}
        </View>
        <ErrorText message={errors.viewingDays} />
      </Anchor>
      <Anchor id="viewingSlots" className="gap-2">
        <FieldLabel text="Khung giờ / Buổi có thể xem *" />
        {VIEWING_SLOTS.map((slot) => (
          <CheckRow
            key={slot.value}
            label={slot.label}
            description={slot.time}
            checked={state.selectedViewingSlots.includes(slot.value)}
            onPress={() =>
              update((s) => ({
                ...s,
                selectedViewingSlots: toggleValue(s.selectedViewingSlots, slot.value),
              }))
            }
          />
        ))}
        <ErrorText message={errors.viewingSlots} />
      </Anchor>
    </Section>
  );
}
