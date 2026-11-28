import { useEffect, useRef, useSyncExternalStore, type MutableRefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDialog } from '@/components/AppDialog';
import ActiveBookingView from '@/components/appointment/booking/ActiveBookingView';
import type { BookingFlow } from '@/components/appointment/booking/booking-flow';
import ContactStep from '@/components/appointment/booking/ContactStep';
import DateStep from '@/components/appointment/booking/DateStep';
import ListingSummary from '@/components/appointment/booking/ListingSummary';
import SlotStep from '@/components/appointment/booking/SlotStep';
import Icon from '@/components/Icon';
import { isActiveBooking } from '@/lib/appointment';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';

export type SheetDialog = MutableRefObject<ReturnType<typeof useDialog> | null>;

export default function BookingSheet({
  flow,
  dialogRef,
  onClose,
  onSubmit,
  onCancelBooking,
  onViewAll,
  listingTitle,
  listingAddress,
  listingPrice,
  listingThumbnail,
}: {
  flow: BookingFlow;
  dialogRef: SheetDialog;
  onClose: () => void;
  onSubmit: () => void;
  onCancelBooking: () => void;
  onViewAll: () => void;
  listingTitle: string;
  listingAddress?: string;
  listingPrice?: number;
  listingThumbnail?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const showDialog = useDialog();
  const bookGate = useFeatureGate(PERMISSIONS.APPOINTMENT_BOOK);
  const state = useSyncExternalStore(flow.subscribe, flow.get, flow.get);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    dialogRef.current = showDialog;
    return () => {
      dialogRef.current = null;
    };
  }, [dialogRef, showDialog]);

  const activeBooking = isActiveBooking(state.existing) ? state.existing : null;
  const submitDisabled = state.submitting || !state.slot || !bookGate.allowed;

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-overlay/65">
      <View className="flex-1" style={{ paddingTop: insets.top + 8 }}>
        <View
          accessibilityViewIsModal
          className="flex-1 overflow-hidden rounded-t-3xl border border-border bg-background">
          <View className="flex-row items-center gap-3 border-b border-border bg-surface px-4 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
              <Icon name="calendar-outline" size={20} className="text-primary" />
            </View>
            <View className="min-w-0 flex-1">
              <Text accessibilityRole="header" className="text-base font-bold text-foreground">
                {state.rescheduling ? 'Yêu cầu đổi lịch xem nhà' : 'Đặt lịch xem nhà'}
              </Text>
              <Text className="text-xs text-muted-foreground">
                Hẹn gặp trực tiếp chủ nhà tại địa điểm cho thuê
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              className="h-11 w-11 items-center justify-center">
              <Icon name="close" size={22} className="text-muted-foreground" />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-6 px-4 pt-4"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
            <ListingSummary
              title={listingTitle}
              address={listingAddress}
              price={listingPrice}
              thumbnail={listingThumbnail}
            />

            {activeBooking && !state.rescheduling ? (
              <ActiveBookingView
                booking={activeBooking}
                confirmingCancel={state.confirmingCancel}
                cancelReason={state.cancelReason}
                submitting={state.submitting}
                onReschedule={() => flow.setRescheduling(true)}
                onToggleCancel={flow.setConfirmingCancel}
                onChangeCancelReason={(value) => flow.setText('cancelReason', value)}
                onConfirmCancel={() => {
                  Keyboard.dismiss();
                  onCancelBooking();
                }}
                onViewAll={onViewAll}
                onConfirmLayout={() => scrollRef.current?.scrollToEnd({ animated: true })}
              />
            ) : (
              <>
                {state.rescheduling ? (
                  <View className="flex-row items-center gap-2 rounded-2xl border border-warning bg-warning-soft px-3.5 py-2">
                    <Icon name="refresh" size={16} className="text-warning" />
                    <Text className="flex-1 text-xs font-semibold text-warning">
                      Đang chọn lại thời gian mới để gửi chủ nhà xét duyệt
                    </Text>
                    <Pressable
                      onPress={() => flow.setRescheduling(false)}
                      accessibilityRole="button"
                      className="min-h-11 justify-center">
                      <Text className="text-xs font-bold text-muted-foreground underline">
                        Hủy đổi
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <DateStep
                  date={state.date}
                  allowedDays={state.availability?.allowedViewingDays}
                  onSelect={flow.selectDate}
                />
                <SlotStep
                  date={state.date}
                  loading={state.loading}
                  loadError={state.loadError}
                  availability={state.availability}
                  selected={state.slot}
                  onSelect={flow.selectSlot}
                  onRetry={flow.retry}
                />
                <ContactStep state={state} flow={flow} />

                <View className="gap-2">
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      onSubmit();
                    }}
                    disabled={submitDisabled}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: submitDisabled, busy: state.submitting }}
                    className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 ${submitDisabled ? 'opacity-50' : ''}`}>
                    {state.submitting ? null : (
                      <Icon
                        name={state.rescheduling ? 'refresh' : 'calendar-outline'}
                        size={16}
                        className="text-on-brand"
                      />
                    )}
                    <Text className="text-sm font-bold text-on-brand">
                      {state.submitting
                        ? 'Đang gửi yêu cầu...'
                        : state.rescheduling
                          ? 'Gửi yêu cầu đổi lịch hẹn'
                          : 'Xác nhận đặt lịch xem nhà'}
                    </Text>
                  </Pressable>
                  {bookGate.title ? (
                    <Text className="text-center text-xs text-danger">{bookGate.title}</Text>
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
