import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
      setName([profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username);
      setPhone(profile.phone || '');
      setEmail(profile.email);
      setPolicy(rules);
    } catch (e) {
      setError(apiError(e));
    }
  }
  useEffect(() => {
    void loadDefaults();
  }, []);
  async function calculate() {
    if (
      !validDate(moveInDate) ||
      moveInDate < today() ||
      !positiveInteger(months, 240) ||
      !positiveInteger(occupants) ||
      !nonnegativeInteger(bikes) ||
      !nonnegativeInteger(cars)
    ) {
      setError('Kiểm tra ngày vào ở, thời hạn (1–240 tháng), số người (1–100) và số xe không âm.');
      return;
    }
    setBusy(true);
    setError(null);
    setAccepted(false);
    setPreview(null);
    try {
      setPreview({ key, estimate: await estimateRental(payload) });
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
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Gửi yêu cầu thuê" onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-10">
        <ErrorNotice message={error} />
        {!policy ? (
          <Button label="Tải thông tin và chính sách" onPress={loadDefaults} disabled={busy} />
        ) : null}
        <Field
          label="Ngày vào ở (YYYY-MM-DD)"
          value={moveInDate}
          onChangeText={setMoveInDate}
          maxLength={10}
          editable={!busy}
        />
        <Field
          label="Thời hạn thuê (tháng)"
          value={months}
          onChangeText={setMonths}
          keyboardType="number-pad"
          editable={!busy}
        />
        <Field
          label="Số người ở"
          value={occupants}
          onChangeText={setOccupants}
          keyboardType="number-pad"
          editable={!busy}
        />
        <Field
          label="Số xe máy"
          value={bikes}
          onChangeText={setBikes}
          keyboardType="number-pad"
          editable={!busy}
        />
        <Field
          label="Số ô tô"
          value={cars}
          onChangeText={setCars}
          keyboardType="number-pad"
          editable={!busy}
        />
        <Button label="Ước tính chi phí" onPress={calculate} busy={busy} />
        {estimate ? (
          <View className="mt-5 rounded-2xl bg-primary-soft p-4">
            <Text className="font-bold text-foreground">Chi phí do hệ thống tính</Text>
            <Text className="mt-2 text-sm text-secondary">
              Tiền thuê/tháng: {money(estimate.effectiveMonthlyRent)}
            </Text>
            <Text className="mt-2 text-sm text-secondary">
              Tổng dự kiến/tháng: {money(estimate.estimatedMonthlyTotal)}
            </Text>
            <Text className="mt-2 text-sm text-secondary">
              Tiền cọc: {money(estimate.depositAmount)}
            </Text>
            <Text className="mt-2 text-sm text-secondary">
              Sau chấp thuận: {money(estimate.paymentPlan?.amountAfterApproval)}
            </Text>
            <Text className="mt-3 text-xs leading-5 text-muted-foreground">
              {estimate.disclaimer}
            </Text>
            {!estimate.motorbike.allowed || !estimate.car.allowed ? (
              <Text className="mt-2 text-sm text-muted-foreground">
                {estimate.motorbike.note} {estimate.car.note}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Field
          label="Họ tên người thuê"
          value={name}
          onChangeText={setName}
          editable={!busy}
          maxLength={100}
        />
        <Field
          label="Điện thoại"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!busy}
          maxLength={20}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!busy}
          maxLength={150}
        />
        <Field
          label="Ghi chú"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          editable={!busy}
        />
        {policy ? (
          <View className="mt-5 rounded-xl border border-border bg-surface p-4">
            <Text className="font-bold text-foreground">Điều kiện giữ chỗ · {policy.version}</Text>
            <Text className="mt-2 text-sm leading-6 text-secondary">{policy.text}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => setAccepted((value) => !value)}
          disabled={busy || !estimate || !policy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          className="mt-3 min-h-12 justify-center rounded-xl border border-border p-3">
          <Text className="text-sm text-foreground">
            {accepted ? '☑' : '☐'} Tôi đã đọc và đồng ý điều kiện giữ chỗ ở trên.
          </Text>
        </Pressable>
        <Button
          label="Gửi yêu cầu thuê"
          busy={busy}
          disabled={!accepted || !policy || !estimate?.paymentPlan}
          onPress={() =>
            showDialog(
              'Xác nhận gửi yêu cầu thuê',
              'Thông tin và chính sách giữ chỗ sẽ được gửi đến chủ nhà. Tiếp tục?',
              [
                { text: 'Quay lại', style: 'cancel' },
                { text: 'Gửi yêu cầu', onPress: () => void submit() },
              ]
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
