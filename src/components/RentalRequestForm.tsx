import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BookingDatePicker from '@/components/BookingDatePicker';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import { useDialog } from '@/components/AppDialog';
import { apiError } from '@/lib/api-error';
import { nonnegativeInteger, positiveInteger, today, validDate } from '@/lib/form-validation';
import {
  createRentalRequest,
  estimateRental,
  getReservationPolicy,
  type RentalEstimate,
} from '@/services/bookingApi';
import { getUserProfileApi } from '@/services/userApi';
import { money } from '@/services/managementApi';

function displayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function CountField({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  disabled: boolean;
}) {
  const count = Number(value);
  function change(amount: number) {
    if (!value) {
      onChange(String(min));
      return;
    }
    onChange(String(Math.max(min, Math.min(max, count + amount))));
  }
  return (
    <View className="mt-3 flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
      <Text className="flex-1 text-sm font-semibold text-foreground">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          disabled={disabled || count <= min}
          onPress={() => change(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Giảm ${label.toLowerCase()}`}
          accessibilityState={{ disabled: disabled || count <= min }}
          className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Icon name="remove" size={20} className={count <= min ? 'text-subtle' : 'text-primary'} />
        </Pressable>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          editable={!disabled}
          selectTextOnFocus
          className="h-11 w-12 rounded-xl border border-border bg-background text-center text-base font-bold text-foreground selection:text-primary"
        />
        <Pressable
          disabled={disabled || count >= max}
          onPress={() => change(1)}
          accessibilityRole="button"
          accessibilityLabel={`Tăng ${label.toLowerCase()}`}
          accessibilityState={{ disabled: disabled || count >= max }}
          className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Icon name="add" size={20} className={count >= max ? 'text-subtle' : 'text-primary'} />
        </Pressable>
      </View>
    </View>
  );
}

export default function RentalRequestForm({
  listingId,
  onBack,
  onSuccess,
}: {
  listingId: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const showDialog = useDialog();
  const scroll = useRef<ScrollView>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [moveInDate, setMoveInDate] = useState(today());
  const [months, setMonths] = useState('12');
  const [occupants, setOccupants] = useState('1');
  const [bikes, setBikes] = useState('0');
  const [cars, setCars] = useState('0');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [policy, setPolicy] = useState<{ version: string; text: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [preview, setPreview] = useState<{ key: string; estimate: RentalEstimate } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payload = {
    listingId,
    moveInDate,
    leaseMonths: Number(months),
    occupantCount: Number(occupants),
    motorbikeCount: Number(bikes),
    carCount: Number(cars),
  };
  const key = JSON.stringify(payload);
  const estimate = preview?.key === key ? preview.estimate : null;

  async function loadDefaults() {
    setError(null);
    try {
      const [profile, rules] = await Promise.all([getUserProfileApi(), getReservationPolicy()]);
      setName(
        (current) =>
          current ||
          [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
          profile.username
      );
      setPhone((current) => current || profile.phone || '');
      setEmail((current) => current || profile.email);
      setPolicy(rules);
    } catch (e) {
      setError(apiError(e));
    }
  }
  useEffect(() => {
    void loadDefaults();
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  function back() {
    if (busy) return;
    Keyboard.dismiss();
    if (step === 2) setStep(1);
    else onBack();
  }
  async function calculate() {
    if (
      !validDate(moveInDate) ||
      moveInDate < today() ||
      !positiveInteger(months, 240) ||
      !positiveInteger(occupants) ||
      !nonnegativeInteger(bikes) ||
      !nonnegativeInteger(cars)
    ) {
      setError('Kiểm tra ngày vào ở, thời hạn (1–240 tháng), số người (1–100) và số xe (0–100).');
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    setAccepted(false);
    setPreview(null);
    try {
      setPreview({ key, estimate: await estimateRental(payload) });
      setStep(2);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!estimate || !estimate.paymentPlan || !policy || !accepted || busy) return;
    if (!name.trim() || !phone.trim()) {
      setError('Nhập họ tên và số điện thoại liên hệ.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createRentalRequest({
        ...payload,
        renterName: name.trim(),
        renterPhone: phone.trim(),
        renterEmail: email.trim(),
        renterNote: note.trim(),
        reservationPolicyAccepted: accepted,
        reservationPolicyVersion: policy.version,
      });
      showDialog(
        'Đã gửi yêu cầu',
        'Vui lòng theo dõi phản hồi trong Quản lý → Yêu cầu đã gửi.',
        undefined,
        'success'
      );
      onSuccess();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  function confirmSubmit() {
    if (!name.trim() || !phone.trim()) {
      setError('Nhập họ tên và số điện thoại liên hệ.');
      scroll.current?.scrollToEnd({ animated: true });
      return;
    }
    setError(null);
    Keyboard.dismiss();
    showDialog(
      'Xác nhận gửi yêu cầu thuê',
      'Thông tin và chính sách giữ chỗ sẽ được gửi đến chủ nhà. Tiếp tục?',
      [
        { text: 'Quay lại', style: 'cancel' },
        { text: 'Gửi yêu cầu', onPress: () => void submit() },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Gửi yêu cầu thuê" onBack={back} />
      <View className="flex-row gap-3 border-b border-border bg-surface px-5 py-4">
        {[
          { value: 1, label: 'Nhu cầu thuê' },
          { value: 2, label: 'Xem lại & gửi' },
        ].map((item) => (
          <View key={item.value} className="flex-1">
            <Text
              className={
                step >= item.value ? 'text-sm font-bold text-foreground' : 'text-sm text-subtle'
              }>
              {item.value}. {item.label}
            </Text>
            <View
              className={`mt-2 h-1 rounded-full ${step >= item.value ? 'bg-brand' : 'bg-muted'}`}
            />
          </View>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-8 pt-5">
        {step === 1 ? (
          <>
            <Text className="text-xl font-bold text-foreground">Bạn muốn chuyển vào khi nào?</Text>
            <Text className="mb-4 mt-2 text-sm leading-5 text-muted-foreground">
              Chọn ngày trên lịch và cho biết số người, số xe dự kiến.
            </Text>
            <View className="mb-3 flex-row items-center gap-2 rounded-2xl bg-primary-soft p-4">
              <Icon name="calendar-outline" size={20} className="text-primary" />
              <Text className="flex-1 text-sm font-bold text-foreground">
                {displayDate(moveInDate)}
              </Text>
            </View>
            <BookingDatePicker
              value={moveInDate}
              minDate={today()}
              disabled={busy}
              hint="Chọn ngày bạn dự định chuyển vào ở."
              onChange={(value) => {
                setMoveInDate(value);
                setError(null);
              }}
            />
            <Text className="mb-1 mt-6 text-base font-bold text-foreground">
              Thời hạn và người ở
            </Text>
            <CountField
              label="Thời hạn thuê (tháng)"
              value={months}
              onChange={setMonths}
              min={1}
              max={240}
              disabled={busy}
            />
            <View className="mt-3 flex-row gap-2">
              {[6, 12, 24].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setMonths(String(value))}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: months === String(value) }}
                  className={`min-h-11 flex-1 items-center justify-center rounded-xl border px-2 ${months === String(value) ? 'border-brand bg-primary-soft' : 'border-border bg-surface'}`}>
                  <Text
                    className={
                      months === String(value)
                        ? 'text-sm font-bold text-primary'
                        : 'text-sm font-semibold text-secondary'
                    }>
                    {value} tháng
                  </Text>
                </Pressable>
              ))}
            </View>
            <CountField
              label="Số người ở"
              value={occupants}
              onChange={setOccupants}
              min={1}
              max={100}
              disabled={busy}
            />
            <Text className="mb-1 mt-6 text-base font-bold text-foreground">Phương tiện</Text>
            <CountField
              label="Xe máy"
              value={bikes}
              onChange={setBikes}
              min={0}
              max={100}
              disabled={busy}
            />
            <CountField
              label="Ô tô"
              value={cars}
              onChange={setCars}
              min={0}
              max={100}
              disabled={busy}
            />
            <Text className="mt-4 text-xs leading-5 text-muted-foreground">
              Chi phí sẽ được hệ thống tính theo ngày vào ở và nhu cầu bạn chọn.
            </Text>
            <ErrorNotice message={error} />
          </>
        ) : (
          <>
            <Text className="text-xl font-bold text-foreground">Xem lại yêu cầu thuê</Text>
            <Text className="mt-2 text-sm leading-5 text-muted-foreground">
              Kiểm tra chi phí dự kiến, thông tin liên hệ và điều kiện giữ chỗ trước khi gửi.
            </Text>
            <View className="mt-5 rounded-2xl border border-primary-border bg-primary-soft p-4">
              <Text className="text-xs font-semibold text-primary">NHU CẦU CỦA BẠN</Text>
              <Text className="mt-2 text-sm font-bold text-foreground">
                {displayDate(moveInDate)}
              </Text>
              <Text className="mt-1 text-sm text-secondary">
                {months} tháng · {occupants} người · {bikes} xe máy · {cars} ô tô
              </Text>
              <Pressable
                onPress={back}
                disabled={busy}
                accessibilityRole="button"
                className="mt-2 min-h-11 justify-center">
                <Text className="text-sm font-semibold text-primary">Chỉnh sửa nhu cầu</Text>
              </Pressable>
            </View>
            {estimate ? (
              <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
                <View className="flex-row items-center gap-2">
                  <Icon name="calculator-outline" size={20} className="text-primary" />
                  <Text className="text-base font-bold text-foreground">Chi phí dự kiến</Text>
                </View>
                {[
                  ['Tiền thuê mỗi tháng', money(estimate.effectiveMonthlyRent)],
                  ['Tổng dự kiến mỗi tháng', money(estimate.estimatedMonthlyTotal)],
                  ['Tiền cọc', money(estimate.depositAmount)],
                ].map(([label, amount]) => (
                  <View key={label} className="mt-3 flex-row justify-between gap-3">
                    <Text className="flex-1 text-sm text-muted-foreground">{label}</Text>
                    <Text className="text-sm font-semibold text-foreground">{amount}</Text>
                  </View>
                ))}
                {estimate.paymentPlan ? (
                  <View className="mt-4 rounded-xl bg-primary-soft p-3">
                    <Text className="text-xs text-muted-foreground">
                      Thanh toán sau khi được chấp thuận
                    </Text>
                    <Text className="mt-1 text-lg font-bold text-primary">
                      {money(estimate.paymentPlan.amountAfterApproval)}
                    </Text>
                  </View>
                ) : (
                  <Text className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">
                    Chưa có phương án thanh toán cho yêu cầu này.
                  </Text>
                )}
                <Text className="mt-3 text-xs leading-5 text-muted-foreground">
                  {estimate.disclaimer}
                </Text>
                {(!estimate.motorbike.allowed && Number(bikes) > 0) ||
                (!estimate.car.allowed && Number(cars) > 0) ? (
                  <Text className="mt-2 text-sm leading-5 text-warning">
                    {Number(bikes) > 0 ? estimate.motorbike.note : ''}{' '}
                    {Number(cars) > 0 ? estimate.car.note : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text className="mt-7 text-base font-bold text-foreground">Thông tin liên hệ</Text>
            <Text className="mt-1 text-xs leading-5 text-muted-foreground">
              Chủ nhà sẽ dùng thông tin này để phản hồi yêu cầu.
            </Text>
            <Field
              label="Họ tên người thuê"
              value={name}
              onChangeText={setName}
              editable={!busy}
              maxLength={100}
              placeholder="Nhập họ và tên"
              autoComplete="name"
            />
            <Field
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!busy}
              maxLength={20}
              placeholder="Số điện thoại liên hệ"
              autoComplete="tel"
            />
            <Field
              label="Email (không bắt buộc)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!busy}
              maxLength={150}
              placeholder="email@example.com"
              autoComplete="email"
            />
            <Field
              label="Lời nhắn (không bắt buộc)"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
              editable={!busy}
              placeholder="Bạn muốn nhắn gì với chủ nhà?"
            />
            <Text className="mt-2 text-right text-xs text-subtle">{note.length}/500</Text>
            <Text className="mt-7 text-base font-bold text-foreground">Điều kiện giữ chỗ</Text>
            {policy ? (
              <View className="mt-3 rounded-2xl border border-border bg-surface p-4">
                <Text className="text-sm font-bold text-foreground">
                  Phiên bản {policy.version}
                </Text>
                <Text className="mt-2 text-sm leading-6 text-secondary">{policy.text}</Text>
              </View>
            ) : (
              <Button label="Tải lại điều kiện giữ chỗ" onPress={loadDefaults} disabled={busy} />
            )}
            <Pressable
              onPress={() => setAccepted((value) => !value)}
              disabled={busy || !estimate?.paymentPlan || !policy}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: accepted,
                disabled: busy || !estimate?.paymentPlan || !policy,
              }}
              className={`mt-4 min-h-24 flex-row items-center gap-4 rounded-2xl border p-4 ${accepted ? 'border-brand bg-primary-soft' : 'border-border bg-surface'}`}>
              <View
                className={`h-8 w-8 items-center justify-center rounded-lg border-2 ${accepted ? 'border-brand bg-brand' : 'border-border-strong bg-surface'}`}>
                {accepted ? <Icon name="checkmark" size={22} className="text-on-brand" /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold leading-5 text-foreground">
                  Tôi đã đọc và đồng ý điều kiện giữ chỗ
                </Text>
                <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                  Chạm vào ô này để xác nhận trước khi gửi.
                </Text>
              </View>
            </Pressable>
            <ErrorNotice message={error} />
          </>
        )}
      </ScrollView>
      <View className="border-t border-border bg-surface px-5 pb-3 pt-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
            <Icon
              name={step === 1 ? 'calendar-outline' : 'document-text-outline'}
              size={21}
              className="text-primary"
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">
              {step === 1 ? 'Ngày dự định vào ở' : 'Sau khi chủ nhà chấp thuận'}
            </Text>
            <Text className="mt-1 text-sm font-bold text-foreground">
              {step === 1
                ? displayDate(moveInDate)
                : estimate?.paymentPlan
                  ? money(estimate.paymentPlan.amountAfterApproval)
                  : 'Chưa có chi phí'}
            </Text>
          </View>
        </View>
        <Button
          label={step === 1 ? 'Xem chi phí & tiếp tục' : 'Gửi yêu cầu thuê'}
          busy={busy}
          disabled={step === 2 && (!accepted || !policy || !estimate?.paymentPlan)}
          onPress={() => (step === 1 ? void calculate() : confirmSubmit())}
        />
      </View>
    </SafeAreaView>
  );
}
