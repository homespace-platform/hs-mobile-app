// Occupants and vehicles (RentalRequestModal.tsx:755-985).
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import Badge from '@/components/rental/shared/Badge';
import {
  clampValue,
  hasPersonBasedCharges,
  hasVehicleParkingAllowed,
} from '@/lib/rental/rental-request.helper';
import type { VehicleSlotEstimate } from '@/types/rental/rental-request.type';

import { FormLabel, StepButton, SuffixInput } from './RequestFormControls';
import type { RentalRequestForm } from './useRentalRequestForm';

export function OccupantField({
  form,
  listingPrice,
}: {
  form: RentalRequestForm;
  listingPrice: number;
}) {
  const { occupantCount, occupantLimit, estimate } = form;
  const maximum = occupantLimit ?? 20;
  return (
    <View className="gap-2">
      <FormLabel
        icon="people-outline"
        title="Số người sẽ ở thường xuyên"
        required
        aside={occupantLimit ? `Tối đa ${occupantLimit} người theo bài đăng` : 'Tối thiểu 1 người'}
      />
      {hasPersonBasedCharges(estimate) ||
      (estimate && estimate.effectiveMonthlyRent > (listingPrice || 0)) ? (
        <View className="flex-row items-center gap-1">
          <Icon name="information-circle-outline" size={14} className="text-primary" />
          <Text className="flex-1 text-xs font-medium text-primary">
            Số người được dùng để tính tiền thuê / phí nước.
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-1.5">
        <SuffixInput
          suffix="người"
          keyboardType="number-pad"
          selectTextOnFocus
          value={occupantCount ? String(occupantCount) : ''}
          placeholder={`Nhập số người (tối đa ${maximum})`}
          accessibilityLabel={`Nhập số người (tối đa ${maximum})`}
          onChangeText={form.typeOccupants}
          onBlur={form.blurOccupants}
        />
        <StepButton
          text="-1"
          label="Giảm 1 người"
          disabled={occupantCount <= 1}
          onPress={() => form.stepOccupants(-1)}
        />
        <StepButton
          text="+1"
          label="Tăng 1 người"
          disabled={occupantCount >= maximum}
          onPress={() => form.stepOccupants(1)}
        />
      </View>
    </View>
  );
}

function VehicleRow({
  name,
  slot,
  count,
  occupants,
  onChange,
}: {
  name: string;
  slot: VehicleSlotEstimate;
  count: number;
  occupants: number;
  onChange: (count: number) => void;
}) {
  const maximum = Math.min(slot.available, Math.max(1, occupants || 1));
  return (
    <View className="gap-2 rounded-xl border border-border bg-surface p-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-bold text-foreground">{name}</Text>
        <Badge tone={slot.available > 0 ? 'success' : 'danger'}>
          {slot.available > 0 ? `Còn ${slot.available} chỗ` : 'Hết chỗ'}
        </Badge>
      </View>
      {slot.note ? (
        <Text className="text-xs leading-5 text-muted-foreground">{slot.note}</Text>
      ) : null}
      <View className="flex-row justify-end gap-1.5">
        <StepButton
          text="-"
          label={`${name}: -`}
          disabled={count <= 0}
          onPress={() => onChange(Math.max(0, count - 1))}
        />
        <SuffixInput
          className="w-20"
          keyboardType="number-pad"
          selectTextOnFocus
          textAlign="center"
          value={String(count)}
          accessibilityLabel={name}
          onChangeText={(text) => {
            const value = parseInt(text, 10);
            onChange(isNaN(value) ? 0 : clampValue(value, 0, maximum));
          }}
        />
        <StepButton
          text="+"
          label={`${name}: +`}
          disabled={count >= maximum}
          onPress={() => onChange(Math.min(maximum, count + 1))}
        />
      </View>
    </View>
  );
}

export function VehicleFields({ form }: { form: RentalRequestForm }) {
  const { estimate } = form;
  if (!estimate || !hasVehicleParkingAllowed(estimate)) return null;
  return (
    <View className="gap-2 rounded-2xl border border-border bg-muted p-3">
      <FormLabel
        icon="bicycle-outline"
        title="Phương tiện mang theo"
        aside="Chỗ khả dụng theo lịch thuê"
      />
      {estimate.motorbike.allowed ? (
        <VehicleRow
          name="Xe máy"
          slot={estimate.motorbike}
          count={form.motorbikeCount}
          occupants={form.occupantCount}
          onChange={form.setMotorbikeCount}
        />
      ) : null}
      {estimate.car.allowed ? (
        <VehicleRow
          name="Ô tô"
          slot={estimate.car}
          count={form.carCount}
          occupants={form.occupantCount}
          onChange={form.setCarCount}
        />
      ) : null}
    </View>
  );
}
