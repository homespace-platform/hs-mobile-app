import type { ComponentProps } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import Icon from '@/components/Icon';
import { BOOKING_LIMITS, formatDateLabel, formatTimeRange } from '@/lib/appointment';
import type { AppointmentResponse } from '@/types/appointment';

function DetailTile({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <Icon name={icon} size={18} className="text-primary" />
      <View className="flex-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className="text-sm font-bold text-foreground">{value}</Text>
      </View>
    </View>
  );
}

/** The renter already holds a PENDING or CONFIRMED booking of this listing. */
export default function ActiveBookingView({
  booking,
  confirmingCancel,
  cancelReason,
  submitting,
  onReschedule,
  onToggleCancel,
  onChangeCancelReason,
  onConfirmCancel,
  onViewAll,
  onConfirmLayout,
}: {
  booking: AppointmentResponse;
  confirmingCancel: boolean;
  cancelReason: string;
  submitting: boolean;
  onReschedule: () => void;
  onToggleCancel: (open: boolean) => void;
  onChangeCancelReason: (value: string) => void;
  onConfirmCancel: () => void;
  onViewAll: () => void;
  onConfirmLayout: () => void;
}) {
  const confirmed = booking.status === 'CONFIRMED';
  return (
    <View className="gap-4">
      <View className="gap-3 rounded-2xl border-2 border-primary-border bg-primary-soft p-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="text-xs font-bold uppercase text-muted-foreground">
            Lịch hẹn hiện tại của bạn
          </Text>
          <View
            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1 ${confirmed ? 'border-success bg-success-soft' : 'border-warning bg-warning-soft'}`}>
            <Icon
              name={confirmed ? 'checkmark-circle-outline' : 'time-outline'}
              size={14}
              className={confirmed ? 'text-success' : 'text-warning'}
            />
            <Text className={`text-xs font-bold ${confirmed ? 'text-success' : 'text-warning'}`}>
              {confirmed ? 'Chủ nhà đã xác nhận' : 'Chờ chủ nhà xác nhận'}
            </Text>
          </View>
        </View>

        <DetailTile
          icon="calendar-outline"
          label="Ngày xem"
          value={formatDateLabel(booking.appointmentDate)}
        />
        <DetailTile
          icon="time-outline"
          label="Khung giờ"
          value={formatTimeRange(booking.startTime, booking.endTime)}
        />

        {booking.ownerNote ? (
          <View className="flex-row items-start gap-2.5 rounded-xl border border-border bg-surface p-3">
            <Icon name="information-circle-outline" size={18} className="text-primary" />
            <View className="flex-1">
              <Text className="text-xs font-semibold text-foreground">Lời dặn từ chủ nhà:</Text>
              <Text className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {booking.ownerNote}
              </Text>
            </View>
          </View>
        ) : null}

        {booking.rescheduleRequested ? (
          <View className="gap-1 rounded-xl border border-warning bg-warning-soft p-3.5">
            <View className="flex-row items-center gap-1.5">
              <Icon name="alert-circle-outline" size={16} className="text-warning" />
              <Text className="flex-1 text-xs font-bold text-warning">
                Đang chờ chủ nhà duyệt yêu cầu đổi lịch:
              </Text>
            </View>
            <Text className="text-xs leading-5 text-secondary">
              Ngày mới đề xuất:{' '}
              <Text className="font-bold text-foreground">
                {formatDateLabel(booking.proposedDate)}
              </Text>{' '}
              lúc{' '}
              <Text className="font-bold text-foreground">
                {formatTimeRange(booking.proposedStartTime, booking.proposedEndTime)}
              </Text>
            </Text>
          </View>
        ) : null}
      </View>

      <View className="gap-3">
        {booking.rescheduleRequested ? null : (
          <Pressable
            onPress={onReschedule}
            accessibilityRole="button"
            className="min-h-12 items-center justify-center rounded-xl border-2 border-primary px-4 py-3">
            <Text className="text-sm font-bold text-primary">Yêu cầu đổi ngày / giờ khác</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => onToggleCancel(true)}
          accessibilityRole="button"
          className="min-h-12 items-center justify-center rounded-xl border border-danger px-4 py-3">
          <Text className="text-sm font-bold text-danger">Hủy lịch hẹn</Text>
        </Pressable>
        <Pressable
          onPress={onViewAll}
          accessibilityRole="button"
          className="min-h-11 flex-row items-center justify-center gap-1.5 rounded-xl bg-muted px-4 py-2.5">
          <Text className="text-xs font-semibold text-foreground">Xem tất cả lịch hẹn của bạn</Text>
          <Icon name="chevron-forward" size={14} className="text-foreground" />
        </Pressable>
      </View>

      {/* Inline, as on web: no second Modal needed to confirm. */}
      {confirmingCancel ? (
        <View
          onLayout={onConfirmLayout}
          className="gap-3 rounded-2xl border border-danger bg-danger-soft p-4">
          <Text accessibilityRole="alert" className="text-xs font-semibold text-danger">
            Bạn có chắc chắn muốn hủy lịch hẹn này?
          </Text>
          <TextInput
            value={cancelReason}
            onChangeText={onChangeCancelReason}
            maxLength={BOOKING_LIMITS.reasonLength}
            placeholder="Nhập lý do hủy (tùy chọn)..."
            accessibilityLabel="Lý do hủy"
            className="min-h-11 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-foreground selection:text-primary placeholder:text-subtle"
          />
          <View className="flex-row justify-end gap-2">
            <Pressable
              onPress={() => onToggleCancel(false)}
              accessibilityRole="button"
              className="min-h-11 justify-center rounded-lg px-3">
              <Text className="text-xs font-semibold text-secondary">Quay lại</Text>
            </Pressable>
            <Pressable
              onPress={onConfirmCancel}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting, busy: submitting }}
              className={`min-h-11 justify-center rounded-lg bg-danger-solid px-3.5 ${submitting ? 'opacity-50' : ''}`}>
              <Text className="text-xs font-bold text-on-danger-solid">
                {submitting ? 'Đang hủy...' : 'Xác nhận hủy lịch'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
