// Port of hs-web-app components/appointment/AppointmentCardCompact.tsx.
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import {
  canQuickApprove,
  formatDateLabel,
  formatTimeRange,
  formatVND,
  getSlotTypeLabel,
} from '@/lib/appointment';
import type { AppointmentResponse, AppointmentViewRole } from '@/types/appointment';

import { ListingThumb, StatusBadge } from './AppointmentBits';

export default function AppointmentCard({
  appointment,
  viewRole,
  manageLock,
  onViewDetail,
  onQuickApprove,
}: {
  appointment: AppointmentResponse;
  viewRole: AppointmentViewRole;
  /** useFeatureGate(APPOINTMENT_MANAGE).title; undefined when allowed. */
  manageLock?: string;
  onViewDetail: (appointment: AppointmentResponse) => void;
  onQuickApprove: (appointment: AppointmentResponse) => void;
}) {
  const quickApprove = canQuickApprove(appointment, viewRole);
  return (
    // Not one accessibility element: "Duyệt" and "Chi tiết" must stay reachable.
    <Pressable
      accessible={false}
      onPress={() => onViewDetail(appointment)}
      className="mb-3 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <ListingThumb url={appointment.listingThumbnail} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-bold text-foreground">
            {appointment.listingTitle}
          </Text>
          {appointment.listingAddress ? (
            <Text numberOfLines={1} className="mt-0.5 text-xs text-muted-foreground">
              {appointment.listingAddress}
            </Text>
          ) : null}
          {appointment.listingPrice ? (
            <Text className="mt-0.5 text-xs font-bold text-primary">
              {formatVND(appointment.listingPrice)} / tháng
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-3 gap-1.5 border-t border-border pt-3">
        <View className="flex-row items-center gap-2">
          <Icon name="calendar-outline" size={14} className="text-primary" />
          <Text className="flex-1 text-xs font-bold text-foreground">
            {formatDateLabel(appointment.appointmentDate)}
          </Text>
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <Icon name="time-outline" size={14} className="text-primary" />
          <Text className="text-xs text-muted-foreground">
            {formatTimeRange(appointment.startTime, appointment.endTime)}
          </Text>
          <Text className="overflow-hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-secondary">
            {getSlotTypeLabel(appointment.slotType)}
          </Text>
        </View>
      </View>

      <View className="mt-2 gap-1.5">
        {viewRole === 'OWNER' ? (
          <>
            <View className="flex-row items-center gap-2">
              <Icon name="person-outline" size={14} className="text-muted-foreground" />
              <Text numberOfLines={1} className="shrink text-xs font-bold text-foreground">
                {appointment.renterName}
              </Text>
              <Text className="text-xs text-muted-foreground">
                ({appointment.visitorCount} người)
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Icon name="call-outline" size={14} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">{appointment.renterPhone}</Text>
            </View>
          </>
        ) : (
          <>
            <Text numberOfLines={1} className="text-xs text-muted-foreground">
              Lời dặn:{' '}
              <Text className="font-medium italic text-foreground">
                {appointment.ownerNote ? `"${appointment.ownerNote}"` : 'Không có lời dặn'}
              </Text>
            </Text>
            <Text className="text-xs text-muted-foreground">
              {appointment.visitorCount > 1
                ? `Đi cùng: ${appointment.visitorCount} người`
                : 'Đi xem một mình'}
            </Text>
          </>
        )}
      </View>

      {appointment.rescheduleRequested ? (
        <View className="mt-3 flex-row items-center gap-1.5 rounded-lg border border-warning bg-warning-soft px-2.5 py-1.5">
          <Icon name="sync-outline" size={13} className="text-warning" />
          <Text className="flex-1 text-xs font-semibold text-warning">
            Khách xin đổi sang:{' '}
            <Text className="font-bold">{formatDateLabel(appointment.proposedDate)}</Text> (
            {formatTimeRange(appointment.proposedStartTime, appointment.proposedEndTime)})
          </Text>
        </View>
      ) : null}

      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <StatusBadge status={appointment.status} />
        <View className="flex-row items-center gap-2">
          {quickApprove ? (
            <Pressable
              onPress={() => onQuickApprove(appointment)}
              disabled={Boolean(manageLock)}
              accessibilityRole="button"
              accessibilityLabel="Duyệt"
              accessibilityHint={manageLock ?? 'Chấp nhận lịch hẹn'}
              accessibilityState={{ disabled: Boolean(manageLock) }}
              className={`min-h-11 flex-row items-center gap-1 rounded-xl bg-brand px-3 ${manageLock ? 'opacity-40' : ''}`}>
              <Icon name="checkmark" size={15} className="text-on-brand" />
              <Text className="text-xs font-bold text-on-brand">Duyệt</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onViewDetail(appointment)}
            accessibilityRole="button"
            accessibilityLabel={`Chi tiết ${appointment.listingTitle}`}
            className="min-h-11 flex-row items-center gap-1.5 rounded-xl border border-border bg-surface px-3">
            <Icon name="eye-outline" size={15} className="text-muted-foreground" />
            <Text className="text-xs font-semibold text-foreground">Chi tiết</Text>
          </Pressable>
        </View>
      </View>
      {quickApprove && manageLock ? (
        <Text className="mt-2 text-right text-xs text-warning">{manageLock}</Text>
      ) : null}
    </Pressable>
  );
}
