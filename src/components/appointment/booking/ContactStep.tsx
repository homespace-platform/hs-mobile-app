import type { ComponentProps } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import type { BookingFlow, BookingState } from '@/components/appointment/booking/booking-flow';
import StepHeading from '@/components/appointment/booking/StepHeading';
import Icon from '@/components/Icon';
import { BOOKING_LIMITS } from '@/lib/appointment';

const INPUT = 'text-sm text-foreground selection:text-primary placeholder:text-subtle';

function ContactField({
  label,
  icon,
  ...props
}: TextInputProps & { label: string; icon: ComponentProps<typeof Icon>['name'] }) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-foreground">
        {label}
        <Text className="text-danger"> *</Text>
      </Text>
      <View className="min-h-11 flex-row items-center gap-2 rounded-xl border border-border bg-surface px-3">
        <Icon name={icon} size={16} className="text-muted-foreground" />
        <TextInput accessibilityLabel={label} {...props} className={`flex-1 py-2.5 ${INPUT}`} />
      </View>
    </View>
  );
}

function StepperButton({
  symbol,
  label,
  onPress,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface">
      <Text className="text-base font-bold text-foreground">{symbol}</Text>
    </Pressable>
  );
}

export default function ContactStep({ state, flow }: { state: BookingState; flow: BookingFlow }) {
  const noteField = state.rescheduling ? 'rescheduleReason' : 'renterNote';
  const noteLabel = state.rescheduling ? 'Lý do xin đổi lịch hẹn' : 'Ghi chú gửi chủ nhà';
  return (
    <View className="gap-4 border-t border-border pt-4">
      <StepHeading icon="person-outline" title="3. Thông tin người đi xem" />

      <ContactField
        label="Họ và tên"
        icon="person-outline"
        value={state.renterName}
        onChangeText={(value) => flow.setText('renterName', value)}
        placeholder="Nhập họ và tên của bạn..."
        maxLength={BOOKING_LIMITS.nameLength}
        autoComplete="name"
      />
      <ContactField
        label="Số điện thoại"
        icon="call-outline"
        value={state.renterPhone}
        onChangeText={(value) => flow.setText('renterPhone', value)}
        placeholder="Số điện thoại nhận xác nhận..."
        maxLength={BOOKING_LIMITS.phoneLength}
        keyboardType="phone-pad"
        autoComplete="tel"
      />

      <View className="gap-2 rounded-2xl border border-border bg-muted p-3.5">
        <View className="flex-row items-center gap-2.5">
          <Icon name="people-outline" size={18} className="text-primary" />
          <View className="flex-1">
            <Text className="text-xs font-bold text-foreground">Số người cùng tham quan</Text>
            <Text className="text-[11px] text-muted-foreground">
              Bao gồm cả bạn và người thân / bạn bè
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-end gap-3">
          <StepperButton symbol="–" label="Giảm số người" onPress={() => flow.stepVisitors(-1)} />
          <Text
            accessibilityLiveRegion="polite"
            className="w-6 text-center text-sm font-bold text-foreground">
            {state.visitorCount}
          </Text>
          <StepperButton symbol="+" label="Tăng số người" onPress={() => flow.stepVisitors(1)} />
        </View>
      </View>

      <View className="gap-1.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-xs font-semibold text-foreground">{noteLabel}</Text>
          <Text className="text-[11px] text-muted-foreground">Tối đa 500 ký tự</Text>
        </View>
        <TextInput
          value={state[noteField]}
          onChangeText={(value) => flow.setText(noteField, value)}
          maxLength={BOOKING_LIMITS.noteLength}
          multiline
          textAlignVertical="top"
          accessibilityLabel={noteLabel}
          placeholder={
            state.rescheduling
              ? 'Ví dụ: Em có việc đột xuất vào giờ cũ, muốn xin dời sang khung giờ này...'
              : 'Ví dụ: Tôi muốn hỏi thêm về chỗ để ô tô, khoảng cách ra bến xe...'
          }
          className={`min-h-24 rounded-xl border border-border bg-surface p-3 ${INPUT}`}
        />
      </View>
    </View>
  );
}
