import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import Ionicons from '@/components/Icon';
import LocationPicker, { type City } from './LocationPicker';

export default function HomeLocationFilter({
  city,
  wardId,
  locationLabel,
  onChangeLocation,
}: {
  city: City;
  wardId: string;
  locationLabel: string;
  onChangeLocation: (city: City, wardId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Khu vực: ${locationLabel}. Chạm để đổi`}
        className="mt-2 min-h-12 max-w-full flex-row items-center self-start rounded-full border border-primary-border bg-muted px-3.5">
        <Ionicons name="location" size={16} className="text-primary" />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="mx-1.5 shrink text-left text-sm font-semibold text-foreground">
          {locationLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} className="text-muted-foreground" />
      </Pressable>

      <LocationPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        city={city}
        wardId={wardId}
        onChange={onChangeLocation}
      />
    </>
  );
}
