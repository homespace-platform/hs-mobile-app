import { format } from 'date-fns';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import StepHeading from '@/components/appointment/booking/StepHeading';
import Icon from '@/components/Icon';
import { Button, ErrorNotice } from '@/components/Screen';
import {
  formatTimeRange,
  getSlotView,
  groupSlots,
  isSameSlot,
  TONE_CLASSES,
} from '@/lib/appointment';
import type { AvailabilitySlot, ListingAvailabilityResponse } from '@/types/appointment';

function Notice({ message }: { message: string }) {
  return (
    <View className="rounded-2xl border border-border bg-muted p-6">
      <Text className="text-center text-xs leading-5 text-muted-foreground">{message}</Text>
    </View>
  );
}

function SlotButton({
  slot,
  selected,
  onSelect,
}: {
  slot: AvailabilitySlot;
  selected: boolean;
  onSelect: (slot: AvailabilitySlot) => void;
}) {
  const view = getSlotView(slot);
  const time = formatTimeRange(slot.startTime, slot.endTime);
  return (
    <Pressable
      onPress={() => onSelect(slot)}
      disabled={view.disabled}
      accessibilityRole="radio"
      accessibilityLabel={`${time}, ${view.label}`}
      accessibilityState={{ checked: selected, disabled: view.disabled }}
      className={`min-h-14 w-[48.5%] justify-center rounded-xl border p-2.5 ${selected ? 'border-brand bg-brand' : view.disabled ? 'border-border bg-muted opacity-50' : 'border-border bg-surface'}`}>
      <Text className={`text-xs font-bold ${selected ? 'text-on-brand' : 'text-foreground'}`}>
        {time}
      </Text>
      <Text
        numberOfLines={1}
        className={`mt-0.5 text-[11px] font-medium ${selected ? 'text-on-brand' : TONE_CLASSES[view.tone].text}`}>
        {view.label}
      </Text>
    </Pressable>
  );
}

export default function SlotStep({
  date,
  loading,
  loadError,
  availability,
  selected,
  onSelect,
  onRetry,
}: {
  date: Date;
  loading: boolean;
  loadError: string | null;
  availability: ListingAvailabilityResponse | null;
  selected: AvailabilitySlot | null;
  onSelect: (slot: AvailabilitySlot) => void;
  onRetry: () => void;
}) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <StepHeading icon="time-outline" title="2. Chọn khung giờ (1 tiếng / lượt)" required />
        {selected ? (
          <Text className="text-xs font-bold text-primary">
            Đã chọn: {formatTimeRange(selected.startTime, selected.endTime)}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View className="flex-row items-center justify-center gap-2 p-8">
          <ActivityIndicator className="text-primary" />
          <Text className="shrink text-xs text-muted-foreground">
            Đang tải khung giờ khả dụng cho ngày {format(date, 'dd/MM/yyyy')}...
          </Text>
        </View>
      ) : loadError ? (
        <View>
          <ErrorNotice message={loadError} />
          <Button label="Tải lại khung giờ" onPress={onRetry} />
        </View>
      ) : !availability?.isDayAvailable ? (
        <Notice message="Chủ nhà không tiếp khách vào ngày này. Vui lòng chọn một ngày khác trên lịch." />
      ) : availability.slots.length === 0 ? (
        <Notice message="Không có khung giờ nào khả dụng cho ngày này." />
      ) : (
        groupSlots(availability.slots).map((period) => (
          <View key={period.key} className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Icon name={period.icon} size={15} className="text-muted-foreground" />
              <Text className="text-xs font-bold text-muted-foreground">{period.label}</Text>
            </View>
            <View className="flex-row flex-wrap justify-between gap-y-2">
              {period.slots.map((slot) => (
                <SlotButton
                  key={`${slot.startTime}-${slot.endTime}`}
                  slot={slot}
                  selected={isSameSlot(selected, slot)}
                  onSelect={onSelect}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}
