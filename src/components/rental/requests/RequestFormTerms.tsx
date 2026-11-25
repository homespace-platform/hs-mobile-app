// Move-in date and lease length (RentalRequestModal.tsx:576-753).
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addMonths, format, isBefore, isValid, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';

import AppCalendar from '@/components/appointment/AppCalendar';
import Icon from '@/components/Icon';
import {
  formatDetailedDuration,
  formatLeaseLabel,
  quickLeaseOptions,
} from '@/lib/rental/RentalRequestModal';

import { blurredLeaseInput, typedLeaseMonths } from './logic';
import { FormLabel, StepButton, SuffixInput } from './RequestFormControls';
import type { RentalRequestForm } from './useRentalRequestForm';

const isPastDay = (date: Date) => isBefore(startOfDay(date), startOfDay(new Date()));

export function MoveInDateField({ form }: { form: RentalRequestForm }) {
  const [open, setOpen] = useState(false);
  const label = format(form.moveInDate, "EEEE, 'ngày' dd 'tháng' MM, yyyy", { locale: vi });
  return (
    <View className="gap-2">
      <FormLabel icon="calendar-outline" title="Ngày bắt đầu dọn vào" required />
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={`Ngày bắt đầu dọn vào: ${label}`}
        accessibilityState={{ expanded: open }}
        className="min-h-12 flex-row items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 active:bg-muted">
        <Text className="shrink text-sm font-semibold text-foreground">{label}</Text>
        <Icon name="calendar-outline" size={18} className="text-muted-foreground" />
      </Pressable>
      {open ? (
        <View className="rounded-2xl border border-border bg-surface p-2">
          <AppCalendar
            selected={form.moveInDate}
            disabled={isPastDay}
            onSelect={(date) => {
              form.setMoveInDate(date);
              setOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export function LeaseTermField({
  form,
  minimumLeaseMonths,
}: {
  form: RentalRequestForm;
  minimumLeaseMonths: number;
}) {
  const { leaseMonths } = form;
  const minimum = minimumLeaseMonths || 1;
  const end = addMonths(form.moveInDate, leaseMonths);
  return (
    <View className="gap-2">
      <FormLabel
        icon="time-outline"
        title="Thời hạn thuê"
        required
        aside={minimumLeaseMonths ? `Tối thiểu ${minimumLeaseMonths} tháng` : undefined}
      />
      <View className="flex-row flex-wrap gap-2">
        {quickLeaseOptions(minimumLeaseMonths).map((months) => {
          const disabled = Boolean(minimumLeaseMonths && months < minimumLeaseMonths);
          const selected = leaseMonths === months;
          return (
            <Pressable
              key={months}
              disabled={disabled}
              onPress={() => form.setLeaseMonths(months)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              className={`min-h-11 w-[48%] grow items-center justify-center rounded-xl border px-2 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'} ${disabled ? 'opacity-40' : ''}`}>
              <Text
                className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-foreground'}`}>
                {formatLeaseLabel(months)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row gap-1.5">
        <SuffixInput
          suffix="tháng"
          keyboardType="number-pad"
          value={form.monthsInput}
          placeholder={`Nhập số tháng (tối thiểu ${minimum} tháng)`}
          accessibilityLabel={`Nhập số tháng (tối thiểu ${minimum} tháng)`}
          onChangeText={(text) => form.typeMonths(text, typedLeaseMonths(text))}
          onBlur={() =>
            form.setMonthsInput(
              blurredLeaseInput(form.monthsInput, minimumLeaseMonths, leaseMonths)
            )
          }
        />
        <StepButton
          text="-1"
          label="Giảm 1 tháng"
          disabled={leaseMonths <= minimum}
          onPress={() => form.setLeaseMonths(Math.max(minimum, leaseMonths - 1))}
        />
        <StepButton
          text="+1"
          label="Tăng 1 tháng"
          onPress={() => form.setLeaseMonths(leaseMonths + 1)}
        />
        <StepButton
          text="+1 năm"
          label="Tăng 1 năm (12 tháng)"
          onPress={() => form.setLeaseMonths(leaseMonths + 12)}
        />
      </View>

      <View className="gap-1 rounded-xl border border-border bg-muted p-3">
        <View className="flex-row flex-wrap justify-between gap-2">
          <Text className="text-xs text-muted-foreground">Thời gian thuê:</Text>
          <Text className="text-xs font-bold text-foreground">
            {formatDetailedDuration(leaseMonths)}
          </Text>
        </View>
        {isValid(end) ? (
          <View className="flex-row flex-wrap justify-between gap-2">
            <Text className="text-xs text-muted-foreground">Dự kiến kết thúc hợp đồng:</Text>
            <Text className="text-xs font-semibold text-foreground">
              {format(end, 'dd/MM/yyyy')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
