// Port of hs-web-app components/appointment/AppointmentDetailModal.tsx.
import type { ComponentProps, ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import {
  CANCELLED_BY_LABELS,
  formatDateLabel,
  formatTimeRange,
  formatVND,
  getAppointmentActions,
  getSlotTypeLabel,
  type AppointmentAction,
  type AppointmentActionOption,
} from '@/lib/appointment';
import { PERMISSIONS, type PermissionCode } from '@/lib/permissions';
import type { AppointmentResponse, AppointmentViewRole } from '@/types/appointment';

import { ListingThumb, StatusBadge } from './AppointmentBits';
import Overlay from './Overlay';

const ACTION_ICONS: Partial<Record<AppointmentAction, ComponentProps<typeof Icon>['name']>> = {
  approve: 'checkmark',
  'approve-reschedule': 'checkmark',
  complete: 'calendar-outline',
  'request-reschedule': 'sync-outline',
};

function buttonTone({ action, danger }: AppointmentActionOption) {
  if (danger) return { box: 'border border-danger bg-surface', text: 'text-danger' };
  if (action === 'complete')
    return { box: 'border border-success bg-success-soft', text: 'text-success' };
  return { box: 'bg-brand', text: 'text-on-brand' };
}

function InfoRow({
  icon,
  children,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  children: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon name={icon} size={16} className="text-muted-foreground" />
      <View className="min-w-0 flex-1">{children}</View>
    </View>
  );
}

export default function AppointmentDetailModal({
  appointment,
  viewRole,
  manageLock,
  bookLock,
  onClose,
  onOpenListing,
  onAction,
}: {
  appointment: AppointmentResponse;
  viewRole: AppointmentViewRole;
  /** useFeatureGate(...).title; undefined when allowed. */
  manageLock?: string;
  bookLock?: string;
  onClose: () => void;
  onOpenListing: (listingId: string) => void;
  /** The caller closes this layer, then runs the action. */
  onAction: (action: AppointmentAction, appointment: AppointmentResponse) => void;
}) {
  const showDialog = useDialog();
  const actions = getAppointmentActions(appointment, viewRole);
  const lockOf = (permission: PermissionCode | null) =>
    permission === PERMISSIONS.APPOINTMENT_MANAGE
      ? manageLock
      : permission === PERMISSIONS.APPOINTMENT_BOOK
        ? bookLock
        : undefined;

  function renderActions(placement: AppointmentActionOption['placement']) {
    return actions
      .filter((item) => item.placement === placement)
      .map((item) => {
        const locked = Boolean(lockOf(item.permission));
        const tone = buttonTone(item);
        const icon = ACTION_ICONS[item.action];
        return (
          <Pressable
            key={item.action}
            onPress={() => onAction(item.action, appointment)}
            disabled={locked}
            accessibilityRole="button"
            accessibilityHint={lockOf(item.permission)}
            accessibilityState={{ disabled: locked }}
            className={`min-h-11 flex-row items-center justify-center gap-1.5 rounded-xl px-4 py-2 ${placement === 'banner' ? 'flex-1' : ''} ${tone.box} ${locked ? 'opacity-40' : ''}`}>
            {icon ? <Icon name={icon} size={15} className={tone.text} /> : null}
            <Text className={`text-center text-xs font-bold ${tone.text}`}>{item.label}</Text>
          </Pressable>
        );
      });
  }

  const locksFor = (placement: AppointmentActionOption['placement']) =>
    [
      ...new Set(
        actions
          .filter((item) => item.placement === placement)
          .map((item) => lockOf(item.permission))
      ),
    ].filter(Boolean);

  const call = () =>
    void Linking.openURL(`tel:${appointment.renterPhone}`).catch(() =>
      showDialog('Thông báo', 'Thiết bị không mở được ứng dụng gọi điện.')
    );

  return (
    <Overlay>
      <View className="max-h-full w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-surface">
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
            <StatusBadge status={appointment.status} />
            <Text className="text-xs text-muted-foreground">Mã: {appointment.id.slice(0, 8)}</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng chi tiết lịch hẹn"
            className="h-11 w-11 items-center justify-center rounded-full">
            <Icon name="close" size={20} className="text-muted-foreground" />
          </Pressable>
        </View>

        <ScrollView className="shrink" contentContainerClassName="gap-4 p-4">
          <View className="gap-3 rounded-2xl border border-border bg-muted p-3">
            <View className="flex-row items-center gap-3">
              <ListingThumb url={appointment.listingThumbnail} large />
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm font-bold text-foreground">
                  {appointment.listingTitle}
                </Text>
                {appointment.listingAddress ? (
                  <View className="mt-0.5 flex-row items-center gap-1">
                    <Icon name="location-outline" size={13} className="text-muted-foreground" />
                    <Text numberOfLines={1} className="flex-1 text-xs text-muted-foreground">
                      {appointment.listingAddress}
                    </Text>
                  </View>
                ) : null}
                {appointment.listingPrice ? (
                  <Text className="mt-1 text-sm font-bold text-primary">
                    {formatVND(appointment.listingPrice)} / tháng
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable
              onPress={() => onOpenListing(appointment.listingId)}
              accessibilityRole="button"
              className="min-h-11 flex-row items-center gap-1.5 self-end rounded-xl border border-border bg-surface px-3">
              <Text className="text-xs font-semibold text-foreground">Xem tin đăng</Text>
              <Icon name="open-outline" size={14} className="text-foreground" />
            </Pressable>
          </View>

          {appointment.rescheduleRequested ? (
            <View className="gap-3 rounded-2xl border-2 border-warning bg-warning-soft p-3">
              <View className="flex-row items-center gap-1.5">
                <Icon name="sync-outline" size={16} className="text-warning" />
                <Text className="flex-1 text-xs font-bold text-warning">
                  Yêu cầu dời lịch hẹn đang chờ duyệt
                </Text>
              </View>
              <View className="rounded-xl border border-border bg-surface p-3">
                <Text className="text-xs text-muted-foreground">Ngày mới đề xuất:</Text>
                <Text className="mt-0.5 text-xs font-bold text-foreground">
                  {formatDateLabel(appointment.proposedDate)}
                </Text>
              </View>
              <View className="rounded-xl border border-border bg-surface p-3">
                <Text className="text-xs text-muted-foreground">Khung giờ mới:</Text>
                <Text className="mt-0.5 text-xs font-bold text-foreground">
                  {formatTimeRange(appointment.proposedStartTime, appointment.proposedEndTime)}
                </Text>
              </View>
              {appointment.rescheduleReason ? (
                <Text className="text-xs text-secondary">
                  <Text className="font-bold">Lý do xin đổi: </Text>
                  <Text className="italic text-foreground">“{appointment.rescheduleReason}”</Text>
                </Text>
              ) : null}
              {viewRole === 'OWNER' ? (
                <View className="flex-row gap-2">{renderActions('banner')}</View>
              ) : null}
              {locksFor('banner').map((lock) => (
                <Text key={lock} className="text-xs text-warning">
                  {lock}
                </Text>
              ))}
            </View>
          ) : null}

          <View className="gap-2.5 rounded-2xl border border-border p-3">
            <Text className="text-xs font-bold uppercase text-muted-foreground">
              Thời gian hẹn xem nhà
            </Text>
            <InfoRow icon="calendar-outline">
              <Text className="text-xs text-muted-foreground">Ngày xem</Text>
              <Text className="text-xs font-bold text-foreground">
                {formatDateLabel(appointment.appointmentDate)}
              </Text>
            </InfoRow>
            <InfoRow icon="time-outline">
              <Text className="text-xs text-muted-foreground">Khung giờ</Text>
              <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
                <Text className="text-xs font-bold text-foreground">
                  {formatTimeRange(appointment.startTime, appointment.endTime)}
                </Text>
                <Text className="overflow-hidden rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-secondary">
                  {getSlotTypeLabel(appointment.slotType)}
                </Text>
              </View>
            </InfoRow>
          </View>

          <View className="gap-2.5 rounded-2xl border border-border p-3">
            <Text className="text-xs font-bold uppercase text-muted-foreground">
              {viewRole === 'OWNER' ? 'Khách hàng liên hệ' : 'Thông tin của bạn'}
            </Text>
            <InfoRow icon="person-outline">
              <Text className="text-xs font-bold text-foreground">{appointment.renterName}</Text>
            </InfoRow>
            <InfoRow icon="call-outline">
              <Pressable
                onPress={call}
                accessibilityRole="link"
                accessibilityLabel={`Gọi ${appointment.renterPhone}`}
                hitSlop={12}
                className="self-start">
                <Text className="text-xs font-semibold text-primary underline">
                  {appointment.renterPhone}
                </Text>
              </Pressable>
            </InfoRow>
            {appointment.renterEmail ? (
              <InfoRow icon="mail-outline">
                <Text selectable className="text-xs text-muted-foreground">
                  {appointment.renterEmail}
                </Text>
              </InfoRow>
            ) : null}
            <InfoRow icon="people-outline">
              <Text className="text-xs text-muted-foreground">
                Số người đi cùng:{' '}
                <Text className="font-bold text-foreground">{appointment.visitorCount} người</Text>
              </Text>
            </InfoRow>
          </View>

          {appointment.renterNote ? (
            <View className="gap-1 rounded-xl border border-border p-3">
              <View className="flex-row items-center gap-1.5">
                <Icon name="chatbox-outline" size={14} className="text-primary" />
                <Text className="text-xs font-semibold text-foreground">Ghi chú từ người đặt:</Text>
              </View>
              <Text className="pl-5 text-xs italic text-muted-foreground">
                “{appointment.renterNote}”
              </Text>
            </View>
          ) : null}

          {appointment.ownerNote ? (
            <View className="gap-1 rounded-xl border border-primary-border bg-primary-soft p-3">
              <View className="flex-row items-center gap-1.5">
                <Icon name="information-circle-outline" size={14} className="text-primary" />
                <Text className="text-xs font-semibold text-foreground">Lời dặn từ chủ nhà:</Text>
              </View>
              <Text className="pl-5 text-xs font-medium italic text-foreground">
                “{appointment.ownerNote}”
              </Text>
            </View>
          ) : null}

          {appointment.rejectReason ? (
            <Text className="overflow-hidden rounded-xl border border-danger bg-danger-soft p-3 text-xs text-danger">
              <Text className="font-bold">Lý do từ chối: </Text>
              {appointment.rejectReason}
            </Text>
          ) : null}

          {appointment.cancelReason ? (
            <Text className="overflow-hidden rounded-xl border border-border bg-muted p-3 text-xs text-secondary">
              <Text className="font-bold">
                Lý do hủy
                {appointment.cancelledBy
                  ? ` (${CANCELLED_BY_LABELS[appointment.cancelledBy] || appointment.cancelledBy})`
                  : ''}
                :{' '}
              </Text>
              {appointment.cancelReason}
            </Text>
          ) : null}
        </ScrollView>

        <View className="border-t border-border px-4 py-3">
          <View className="flex-row flex-wrap items-center justify-end gap-2">
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="min-h-11 justify-center rounded-xl border border-border px-4">
              <Text className="text-xs font-semibold text-muted-foreground">Đóng</Text>
            </Pressable>
            {renderActions('footer')}
          </View>
          {locksFor('footer').map((lock) => (
            <Text key={lock} className="mt-2 text-right text-xs text-warning">
              {lock}
            </Text>
          ))}
        </View>
      </View>
    </Overlay>
  );
}
