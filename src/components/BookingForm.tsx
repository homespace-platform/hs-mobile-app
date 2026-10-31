import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BookingDatePicker from '@/components/BookingDatePicker';
import BookingConfirmation from '@/components/BookingConfirmation';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { canBookSlot, viewingPeriod } from '@/lib/booking';
import { today, validDate } from '@/lib/form-validation';
import {
  createAppointment,
  getAvailability,
  rescheduleAppointment,
  type Availability,
} from '@/services/bookingApi';
import { getUserProfileApi } from '@/services/userApi';
import type { Appointment } from '@/services/managementApi';

const PERIODS = [
  { key: 'MORNING', label: 'Buổi sáng', icon: 'sunny-outline' },
  { key: 'AFTERNOON', label: 'Buổi chiều', icon: 'partly-sunny-outline' },
  { key: 'EVENING', label: 'Buổi tối', icon: 'moon-outline' },
] as const;
const SLOT_LABELS: Record<string, string> = {
  AVAILABLE: 'Còn trống',
  LOCKED: 'Đã kín',
  PENDING_YOU: 'Bạn đang chờ duyệt',
  CONFIRMED_YOU: 'Lịch của bạn',
  UNAVAILABLE: 'Không khả dụng',
};

function displayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function BookingForm({
  listingId,
  appointment,
  onBack,
  onSuccess,
}: {
  listingId: string;
  appointment?: Appointment;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate] = useState(() =>
    appointment && appointment.appointmentDate >= today() ? appointment.appointmentDate : today()
  );
  const [availability, setAvailability] = useState<{ date: string; data: Availability } | null>(
    null
  );
  const [allowedDays, setAllowedDays] = useState<string[] | undefined>();
  const [slot, setSlot] = useState<Availability['slots'][number] | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [visitors, setVisitors] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const scroll = useRef<ScrollView>(null);

  const loadContact = useCallback(async () => {
    setProfileError(null);
    try {
      const profile = await getUserProfileApi();
      setName(
        (current) =>
          current ||
          [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
          profile.username
      );
      setPhone((current) => current || profile.phone || '');
    } catch (e) {
      setProfileError(apiError(e));
    }
  }, []);
  useEffect(() => {
    if (!appointment) void loadContact();
  }, [appointment, loadContact]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setSlot(null);
    setAvailability(null);
    setSlotsLoading(true);
    setSlotsError(null);
    getAvailability(listingId, date, controller.signal)
      .then((data) => {
        if (!active) return;
        setAvailability({ date, data });
        setAllowedDays(data.allowedViewingDays);
      })
      .catch((e) => {
        if (active) setSlotsError(apiError(e));
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [listingId, date, reload]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const current = availability?.date === date ? availability.data : null;
  const ready =
    !slotsLoading &&
    validDate(date) &&
    date >= today() &&
    canBookSlot(current, slot, Boolean(appointment));
  const availableCount = current?.slots.filter((item) => item.status === 'AVAILABLE').length ?? 0;
  function back() {
    if (busy) return;
    Keyboard.dismiss();
    if (step === 2) setStep(1);
    else onBack();
  }
  function validateContact() {
    if (
      (!appointment && (!name.trim() || !phone.trim() || visitors < 1 || visitors > 10)) ||
      note.length > 500
    ) {
      setError('Nhập đầy đủ họ tên và số điện thoại. Số người từ 1–10, ghi chú tối đa 500 ký tự.');
      return false;
    }
    return true;
  }
  async function submit() {
    if (busy || !ready || !slot || !validateContact()) return;
    setBusy(true);
    setError(null);
    try {
      if (appointment)
        await rescheduleAppointment(appointment.id, {
          proposedDate: date,
          proposedStartTime: slot.startTime,
          proposedEndTime: slot.endTime,
          rescheduleReason: note.trim(),
        });
      else
        await createAppointment({
          listingId,
          appointmentDate: date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          renterName: name.trim(),
          renterPhone: phone.trim(),
          visitorCount: visitors,
          renterNote: note.trim(),
        });
      setSent(true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title={appointment ? 'Đổi lịch xem nhà' : 'Đặt lịch xem nhà'} onBack={back} />
      <View className="flex-row gap-3 border-b border-border bg-surface px-5 py-4">
        {[
          { value: 1, label: 'Chọn ngày, giờ' },
          { value: 2, label: 'Thông tin' },
        ].map((item) => (
          <View key={item.value} className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${step >= item.value ? 'bg-brand' : 'bg-muted'}`}>
                {step > item.value ? (
                  <Icon name="checkmark" size={14} className="text-on-brand" />
                ) : (
                  <Text
                    className={
                      step >= item.value
                        ? 'text-xs font-bold text-on-brand'
                        : 'text-xs font-bold text-subtle'
                    }>
                    {item.value}
                  </Text>
                )}
              </View>
              <Text
                className={
                  step >= item.value
                    ? 'text-xs font-bold text-foreground'
                    : 'text-xs font-semibold text-subtle'
                }>
                {item.label}
              </Text>
            </View>
            <View className={`h-1 rounded-full ${step >= item.value ? 'bg-brand' : 'bg-muted'}`} />
          </View>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-8 pt-5">
        {step === 1 ? (
          <>
            <Text className="text-xl font-bold text-foreground">Bạn muốn xem nhà khi nào?</Text>
            <Text className="mb-4 mt-2 text-sm leading-5 text-muted-foreground">
              Chọn ngày phù hợp, sau đó chọn một khung giờ còn trống.
            </Text>
            <BookingDatePicker
              value={date}
              minDate={today()}
              allowedDays={allowedDays}
              disabled={busy}
              onChange={(value) => {
                setDate(value);
                setSlot(null);
                setError(null);
              }}
            />
            <View className="mb-3 mt-6 flex-row items-center justify-between">
              <Text className="text-base font-bold text-foreground">Chọn giờ xem</Text>
              {!slotsLoading && current?.isDayAvailable ? (
                <Text className="text-xs font-semibold text-primary">
                  {availableCount} khung giờ trống
                </Text>
              ) : null}
            </View>
            <Text className="mb-3 text-xs text-muted-foreground">{displayDate(date)}</Text>
            {slotsLoading ? (
              <View className="items-center rounded-2xl bg-surface py-8">
                <ActivityIndicator className="text-primary" />
                <Text className="mt-3 text-sm text-muted-foreground">Đang tìm giờ trống...</Text>
              </View>
            ) : slotsError ? (
              <>
                <ErrorNotice message={slotsError} />
                <Button label="Tải lại khung giờ" onPress={() => setReload((value) => value + 1)} />
              </>
            ) : !current?.isDayAvailable || !current.slots.length ? (
              <View className="items-center rounded-2xl border border-border bg-surface px-5 py-6">
                <Icon name="calendar-outline" size={28} className="text-subtle" />
                <Text className="mt-3 text-center text-sm font-semibold text-foreground">
                  Ngày này chưa có giờ xem nhà
                </Text>
                <Text className="mt-2 text-center text-xs leading-5 text-muted-foreground">
                  Bạn chọn một ngày khác trên lịch nhé.
                </Text>
              </View>
            ) : (
              <>
                {availableCount === 0 && (!current.hasExistingActiveBooking || appointment) ? (
                  <Text className="mb-4 rounded-2xl bg-muted p-4 text-sm leading-5 text-muted-foreground">
                    Ngày này không còn khung giờ trống. Bạn chọn một ngày khác trên lịch nhé.
                  </Text>
                ) : null}
                {current.hasExistingActiveBooking && !appointment ? (
                  <Text
                    accessibilityRole="alert"
                    className="mb-3 rounded-2xl bg-warning-soft p-4 text-sm leading-5 text-warning">
                    Bạn đã có lịch xem đang chờ duyệt hoặc đã xác nhận cho tin này. Hãy xem lại
                    trong Quản lý → Lịch đi xem.
                  </Text>
                ) : null}
                {PERIODS.map((period) => {
                  const items = current.slots.filter(
                    (item) => (item.slotType || viewingPeriod(item.startTime)) === period.key
                  );
                  if (!items.length) return null;
                  return (
                    <View key={period.key} className="mb-5">
                      <View className="mb-3 flex-row items-center gap-2">
                        <Icon name={period.icon} size={17} className="text-secondary" />
                        <Text className="text-sm font-semibold text-secondary">{period.label}</Text>
                      </View>
                      {Array.from({ length: Math.ceil(items.length / 2) }, (_, row) => (
                        <View key={row} className="mb-2 flex-row gap-2">
                          {items.slice(row * 2, row * 2 + 2).map((item) => {
                            const selected =
                              slot?.startTime === item.startTime && slot.endTime === item.endTime;
                            const disabled =
                              busy || !canBookSlot(current, item, Boolean(appointment));
                            return (
                              <Pressable
                                key={item.startTime}
                                onPress={() => setSlot(item)}
                                disabled={disabled}
                                accessibilityRole="radio"
                                accessibilityLabel={`${item.startTime.slice(0, 5)} đến ${item.endTime.slice(0, 5)}, ${SLOT_LABELS[item.status] || 'Không khả dụng'}`}
                                accessibilityState={{ checked: selected, disabled }}
                                className={`min-h-20 flex-1 rounded-2xl border px-3 py-3 ${selected ? 'border-brand bg-brand' : disabled ? 'border-border bg-muted' : 'border-primary-border bg-surface'}`}>
                                <View className="flex-row items-center justify-between gap-1">
                                  <Text
                                    className={
                                      selected
                                        ? 'text-sm font-bold text-on-brand'
                                        : disabled
                                          ? 'text-sm font-semibold text-subtle'
                                          : 'text-sm font-bold text-foreground'
                                    }>
                                    {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}
                                  </Text>
                                  {selected ? (
                                    <Icon
                                      name="checkmark-circle"
                                      size={17}
                                      className="text-on-brand"
                                    />
                                  ) : null}
                                </View>
                                <Text
                                  className={`mt-2 text-xs ${selected ? 'text-on-brand-muted' : disabled ? 'text-subtle' : 'text-primary'}`}>
                                  {selected
                                    ? 'Đã chọn'
                                    : SLOT_LABELS[item.status] || 'Không khả dụng'}
                                </Text>
                              </Pressable>
                            );
                          })}
                          {items.slice(row * 2, row * 2 + 2).length === 1 ? (
                            <View className="flex-1" />
                          ) : null}
                        </View>
                      ))}
                    </View>
                  );
                })}
                <Text className="text-xs leading-5 text-muted-foreground">
                  Lịch xem cần được chủ nhà xác nhận sau khi bạn gửi yêu cầu.
                </Text>
              </>
            )}
          </>
        ) : (
          <>
            <Text className="text-xl font-bold text-foreground">
              {appointment ? 'Xác nhận lịch mới' : 'Thông tin người đi xem'}
            </Text>
            <View className="mt-4 rounded-3xl border border-primary-border bg-primary-soft p-4">
              <View className="flex-row items-center gap-2">
                <Icon name="calendar-outline" size={20} className="text-primary" />
                <Text className="flex-1 text-sm font-bold text-foreground">
                  {displayDate(date)}
                </Text>
              </View>
              <Text className="mt-2 text-base font-bold text-primary">
                {slot?.startTime.slice(0, 5)}–{slot?.endTime.slice(0, 5)}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(1)}
                disabled={busy}
                className="mt-2 min-h-11 justify-center">
                <Text className="text-sm font-semibold text-primary">Chọn ngày, giờ khác</Text>
              </Pressable>
            </View>
            {!appointment ? (
              <>
                <ErrorNotice message={profileError} />
                {profileError ? (
                  <Button label="Tải lại thông tin liên hệ" onPress={loadContact} disabled={busy} />
                ) : null}
                <Field
                  label="Họ tên người xem"
                  value={name}
                  onChangeText={setName}
                  editable={!busy}
                  maxLength={100}
                  autoComplete="name"
                />
                <Field
                  label="Số điện thoại liên hệ"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!busy}
                  maxLength={20}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
                <View className="mt-5 flex-row items-center justify-between rounded-2xl border border-border bg-surface p-3">
                  <View>
                    <Text className="text-sm font-semibold text-foreground">Số người đi xem</Text>
                    <Text className="mt-1 text-xs text-muted-foreground">Tối đa 10 người</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Giảm số người"
                      disabled={busy || visitors === 1}
                      onPress={() => setVisitors((value) => Math.max(1, value - 1))}
                      className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
                      <Icon
                        name="remove"
                        size={20}
                        className={visitors === 1 ? 'text-subtle' : 'text-primary'}
                      />
                    </Pressable>
                    <Text
                      accessibilityLiveRegion="polite"
                      className="text-base font-bold text-foreground">
                      {visitors}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Tăng số người"
                      disabled={busy || visitors === 10}
                      onPress={() => setVisitors((value) => Math.min(10, value + 1))}
                      className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
                      <Icon
                        name="add"
                        size={20}
                        className={visitors === 10 ? 'text-subtle' : 'text-primary'}
                      />
                    </Pressable>
                  </View>
                </View>
              </>
            ) : null}
            <Field
              label={
                appointment
                  ? 'Lý do đổi lịch (không bắt buộc)'
                  : 'Lời nhắn cho chủ nhà (không bắt buộc)'
              }
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
              editable={!busy}
              placeholder="Bạn có điều gì muốn nhắn thêm?"
            />
            <Text className="mt-2 text-right text-xs text-subtle">{note.length}/500</Text>
            <ErrorNotice message={error} />
            <Text className="mt-4 text-xs leading-5 text-muted-foreground">
              Chủ nhà sẽ nhận yêu cầu và phản hồi trong mục Quản lý → Lịch đi xem.
            </Text>
          </>
        )}
      </ScrollView>
      <View className="border-t border-border bg-surface px-5 pb-3 pt-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
            <Icon name="time-outline" size={21} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">
              {ready ? date.split('-').reverse().join('/') : 'Lịch xem của bạn'}
            </Text>
            <Text className="mt-1 text-sm font-bold text-foreground">
              {ready
                ? `${slot!.startTime.slice(0, 5)}–${slot!.endTime.slice(0, 5)}`
                : 'Chọn ngày và khung giờ còn trống'}
            </Text>
          </View>
        </View>
        <Button
          label={
            step === 1 ? 'Tiếp tục' : appointment ? 'Gửi đề xuất đổi lịch' : 'Gửi lịch xem nhà'
          }
          busy={busy}
          disabled={!ready}
          onPress={() => {
            Keyboard.dismiss();
            if (step === 1) setStep(2);
            else if (validateContact()) {
              setError(null);
              setConfirming(true);
            }
          }}
        />
      </View>
      <BookingConfirmation
        visible={confirming}
        sent={sent}
        rescheduling={Boolean(appointment)}
        dateLabel={displayDate(date)}
        timeLabel={`${slot?.startTime.slice(0, 5)}–${slot?.endTime.slice(0, 5)}`}
        contact={appointment ? undefined : { name: name.trim(), phone: phone.trim(), visitors }}
        busy={busy}
        error={error}
        onCancel={() => {
          if (busy) return;
          setConfirming(false);
          if (sent) onSuccess();
        }}
        onConfirm={() => void submit()}
      />
    </SafeAreaView>
  );
}
