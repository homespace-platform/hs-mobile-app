import { useState } from 'react';
import { View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import {
  addCustomAmenity,
  customAmenities,
  toggleValue,
  visibleAmenities,
} from '@/lib/listing-form';
import type { ListingCatalog } from '@/services/listingCreateApi';

import { Chip, Section, TextField, type SectionProps } from './ui';

export default function AmenitiesSection({
  state,
  update,
  options,
}: SectionProps & { options: ListingCatalog['amenities'] }) {
  const [input, setInput] = useState('');
  const selected = state.selectedAmenities;
  const toggle = (value: string) =>
    update((s) => ({ ...s, selectedAmenities: toggleValue(s.selectedAmenities, value) }));
  function add() {
    if (addCustomAmenity(selected, input) === selected) return;
    update((s) => ({ ...s, selectedAmenities: addCustomAmenity(s.selectedAmenities, input) }));
    setInput('');
  }

  return (
    <Section title="Tiện ích & Dịch vụ" description="Chọn các tiện ích sẵn có.">
      <View className="flex-row flex-wrap gap-2">
        {visibleAmenities(options).map((item) => (
          <Chip
            key={item.code}
            label={item.name}
            selected={selected.includes(item.code)}
            onPress={() => toggle(item.code)}
          />
        ))}
        {/* Until the catalog arrives every selected code would look custom. */}
        {options.length
          ? customAmenities(selected, options).map((item) => (
              <Chip
                key={item}
                label={item}
                icon="close"
                accessibilityLabel={`Xóa tiện ích ${item}`}
                selected
                onPress={() => toggle(item)}
              />
            ))
          : null}
      </View>
      <TextField
        ariaLabel="Tiện ích khác"
        value={input}
        onChangeText={setInput}
        onSubmitEditing={add}
        returnKeyType="done"
        placeholder="Tiện ích khác (VD: Trạm sạc xe điện)"
      />
      <ActionButton
        label="Thêm"
        icon="add"
        variant="secondary"
        disabled={!input.trim()}
        onClick={add}
      />
    </Section>
  );
}
