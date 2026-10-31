import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { ErrorNotice } from '@/components/Screen';

export default function BookingConfirmation({
  visible,
  sent,
  rescheduling,
  dateLabel,
  timeLabel,
  contact,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  sent: boolean;
  rescheduling: boolean;
  dateLabel: string;
  timeLabel: string;
  contact?: { name: string; phone: string; visitors: number };
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) onCancel();
      }}>
      <View className="flex-1 items-center justify-center bg-overlay/65 px-5 py-8">
        <Pressable
          disabled={busy}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={sent ? 'Đóng thông báo' : 'Quay lại chỉnh lịch'}
          className="absolute inset-0"
        />
        <View
          accessibilityViewIsModal
          className="max-h-[90%] w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface">
          <ScrollView
            key={sent ? 'sent' : 'review'}
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-5 pb-2 pt-6">
            {sent ? (
              <>
                <View className="mb-4 h-20 w-20 items-center justify-center self-center rounded-full bg-success-soft">
                  <Icon name="checkmark-circle" size={50} className="text-success" />
                </View>
                <Text
                  accessibilityRole="header"
                  className="text-center text-2xl font-bold text-foreground">
                  {rescheduling ? 'Đã gửi đề xuất đổi lịch' : 'Đã gửi lịch xem nhà'}
                </Text>
                <Text className="mb-5 mt-2 text-center text-sm leading-5 text-muted-foreground">
                  {rescheduling
                    ? 'Chủ nhà sẽ xem và phản hồi đề xuất của bạn.'
                    : 'Yêu cầu đã được gửi đến chủ nhà. Vui lòng chờ xác nhận nhé.'}
                </Text>
                <View className="rounded-2xl border border-primary-border bg-primary-soft p-4">
                  <View className="flex-row items-start gap-3">
                    <Icon name="calendar-clear-outline" size={19} className="mt-0.5 text-primary" />
                    <View className="flex-1">
                      <Text className="text-xs text-muted-foreground">Ngày xem nhà</Text>
                      <Text className="mt-1 text-sm font-bold leading-5 text-foreground">
                        {dateLabel}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-4 flex-row items-center gap-3 border-t border-primary-border pt-4">
                    <Icon name="time-outline" size={21} className="text-primary" />
                    <Text className="text-xl font-bold text-primary">{timeLabel}</Text>
                  </View>
                </View>
                <View className="mt-4 flex-row items-center gap-2 self-center rounded-full bg-success-soft px-3 py-2">
                  <Icon name="time-outline" size={16} className="text-success" />
                  <Text className="text-xs font-semibold text-success">
                    {rescheduling ? 'Chờ duyệt lịch mới' : 'Chờ chủ nhà xác nhận'}
                  </Text>
                </View>
                <Text className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                  Theo dõi phản hồi trong Quản lý → Lịch đi xem.
                </Text>
              </>
            ) : (
              <>
                <View className="relative mb-4 self-center">
                  <View className="h-16 w-16 items-center justify-center rounded-2xl border border-primary-border bg-primary-soft">
                    <Icon name="calendar-outline" size={30} className="text-primary" />
                  </View>
                  <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-brand">
                    <Icon name="paper-plane" size={13} className="text-on-brand" />
                  </View>
                </View>
                <Text
                  accessibilityRole="header"
                  className="text-center text-2xl font-bold text-foreground">
                  {rescheduling ? 'Xác nhận đổi lịch' : 'Xác nhận lịch xem'}
                </Text>
                <Text className="mb-5 mt-2 text-center text-sm leading-5 text-muted-foreground">
                  Kiểm tra lịch hẹn trước khi gửi đến chủ nhà nhé.
                </Text>
                <View className="rounded-2xl border border-primary-border bg-primary-soft p-4">
                  <View className="flex-row items-start gap-3">
                    <Icon name="calendar-clear-outline" size={19} className="mt-0.5 text-primary" />
                    <View className="flex-1">
                      <Text className="text-xs text-muted-foreground">Ngày xem nhà</Text>
                      <Text className="mt-1 text-sm font-bold leading-5 text-foreground">
                        {dateLabel}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-4 flex-row items-center gap-3 border-t border-primary-border pt-4">
                    <Icon name="time-outline" size={21} className="text-primary" />
                    <View>
                      <Text className="text-xs text-muted-foreground">Khung giờ đã chọn</Text>
                      <Text className="mt-1 text-2xl font-bold text-primary">{timeLabel}</Text>
                    </View>
                  </View>
                </View>
                {contact ? (
                  <View className="mt-3 flex-row items-start gap-3 rounded-2xl bg-muted p-4">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
                      <Icon name="person-outline" size={18} className="text-secondary" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{contact.name}</Text>
                      <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                        {contact.phone} · {contact.visitors} người đi xem
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View className="mt-4 flex-row items-start gap-2 px-1">
                  <Icon
                    name="information-circle-outline"
                    size={17}
                    className="mt-0.5 text-subtle"
                  />
                  <Text className="flex-1 text-xs leading-5 text-muted-foreground">
                    {rescheduling
                      ? 'Lịch mới có hiệu lực sau khi chủ nhà chấp nhận đề xuất.'
                      : 'Lịch hẹn sẽ được giữ ở trạng thái chờ chủ nhà xác nhận.'}
                  </Text>
                </View>
                <ErrorNotice message={error} />
              </>
            )}
          </ScrollView>
          {sent ? (
            <View className="px-5 pb-5 pt-4">
              <Pressable
                disabled={busy}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                className="min-h-12 items-center justify-center rounded-2xl bg-brand px-4 py-4">
                <Text className="text-sm font-bold text-on-brand">Hoàn tất</Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-row gap-3 px-5 pb-5 pt-4">
              <Pressable
                disabled={busy}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                className="min-h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-surface px-3 py-4">
                <Text
                  className={
                    busy
                      ? 'text-sm font-semibold text-subtle'
                      : 'text-sm font-semibold text-secondary'
                  }>
                  Quay lại
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={onConfirm}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-3 py-4 ${busy ? 'bg-disabled' : 'bg-brand'}`}>
                {busy ? (
                  <ActivityIndicator className="text-on-disabled" />
                ) : (
                  <Icon name="paper-plane-outline" size={17} className="text-on-brand" />
                )}
                <Text
                  className={
                    busy ? 'text-sm font-bold text-on-disabled' : 'text-sm font-bold text-on-brand'
                  }>
                  {busy ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
