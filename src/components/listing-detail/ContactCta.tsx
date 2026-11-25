import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import type { ActiveRentalRequest } from '@/services/bookingApi';

const SOON_TITLE = 'Tính năng đang phát triển';
const SOON_MESSAGE = 'Tính năng này đang được phát triển, vui lòng thử lại sau.';

// Visitor call-to-action block of the web overview card. "Yêu cầu thuê nhà", "Đặt lịch xem" and
// the negotiation button are not built on mobile yet, so they only open an "in development" dialog.
export default function ContactCta({
  status,
  acceptsNewRequests,
  publicListing,
  isNegotiable,
  isOwner,
  rentalRequest,
  hasActiveBooking,
  chatting,
  onChat,
  onOpenRequests,
  onOpenBookings,
}: {
  status?: string;
  acceptsNewRequests: boolean;
  publicListing: boolean;
  isNegotiable: boolean;
  isOwner: boolean;
  rentalRequest: ActiveRentalRequest | null;
  hasActiveBooking: boolean;
  chatting: boolean;
  onChat: () => void;
  onOpenRequests: () => void;
  onOpenBookings: () => void;
}) {
  const showDialog = useDialog();
  const soon = () => showDialog(SOON_TITLE, SOON_MESSAGE);
  const ownerNotice = (message: string) => showDialog('Thông báo', message);
  const bookingDisabled = !publicListing && !hasActiveBooking;

  return (
    <View className="mt-5 gap-3 border-t border-border pt-5">
      <Text className="text-base font-bold text-foreground">Bạn quan tâm đến căn này?</Text>

      {rentalRequest ? (
        <View className="items-center gap-2">
          <Pressable
            onPress={onOpenRequests}
            accessibilityRole="button"
            className={`min-h-12 w-full flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3.5 ${rentalRequest.status === 'PENDING' ? 'border-warning bg-warning-soft' : 'border-success bg-success-soft'}`}>
            <Icon
              name={rentalRequest.status === 'PENDING' ? 'time-outline' : 'checkmark-circle'}
              size={18}
              className={rentalRequest.status === 'PENDING' ? 'text-warning' : 'text-success'}
            />
            <Text
              className={`text-sm font-bold ${rentalRequest.status === 'PENDING' ? 'text-warning' : 'text-success'}`}>
              {rentalRequest.status === 'PENDING'
                ? 'Đã gửi yêu cầu thuê (Chờ duyệt)'
                : 'Yêu cầu được duyệt (Đang giữ chỗ)'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onOpenRequests}
            accessibilityRole="link"
            className="min-h-11 flex-row items-center justify-center gap-1">
            <Text className="text-xs font-semibold text-primary">Xem yêu cầu của tôi</Text>
            <Icon name="open-outline" size={12} className="text-primary" />
          </Pressable>
        </View>
      ) : status === 'RESERVED' ? (
        <View
          accessibilityState={{ disabled: true }}
          className="min-h-12 w-full flex-row items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-3.5">
          <Icon name="shield-checkmark-outline" size={18} className="text-muted-foreground" />
          <Text className="text-sm font-bold text-muted-foreground">Đang giữ chỗ (Tạm khóa)</Text>
        </View>
      ) : !acceptsNewRequests ? (
        <View className="rounded-xl border border-border bg-muted p-3">
          <Text className="text-center text-sm font-medium text-muted-foreground">
            Tin hiện không nhận yêu cầu thuê mới
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() =>
            isOwner
              ? ownerNotice('Bạn là chủ bài đăng này, không thể tự gửi yêu cầu thuê.')
              : soon()
          }
          accessibilityRole="button"
          className="min-h-12 w-full flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5">
          <Icon name="home-outline" size={18} className="text-on-brand" />
          <Text className="text-sm font-bold text-on-brand">Yêu cầu thuê nhà</Text>
        </Pressable>
      )}

      <View className="flex-row gap-2.5">
        <Pressable
          disabled={bookingDisabled}
          onPress={() => {
            if (!publicListing) return onOpenBookings();
            if (isOwner) {
              return ownerNotice('Bạn là chủ bài đăng này, không thể tự đặt lịch xem nhà.');
            }
            soon();
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: bookingDisabled }}
          className={`min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 ${hasActiveBooking ? 'border-success bg-success-soft' : 'border-border bg-surface'} ${bookingDisabled ? 'opacity-50' : ''}`}>
          <Icon
            name={hasActiveBooking ? 'checkmark-circle' : 'calendar-outline'}
            size={16}
            className={hasActiveBooking ? 'text-success' : 'text-primary'}
          />
          <Text
            numberOfLines={1}
            className={`text-sm font-bold ${hasActiveBooking ? 'text-success' : 'text-foreground'}`}>
            {hasActiveBooking ? 'Lịch xem của bạn' : 'Đặt lịch xem'}
          </Text>
        </Pressable>
        {isNegotiable && publicListing ? (
          <Pressable
            onPress={() =>
              isOwner
                ? ownerNotice('Bạn là chủ bài đăng này, không thể tự thương lượng.')
                : showDialog('Thông báo', 'Tính năng Thương lượng đang được kết nối!')
            }
            accessibilityRole="button"
            className="min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5">
            <Icon name="cash-outline" size={16} className="text-muted-foreground" />
            <Text numberOfLines={1} className="text-sm font-bold text-foreground">
              Thương lượng
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={onChat}
        disabled={chatting}
        accessibilityRole="button"
        accessibilityState={{ disabled: chatting, busy: chatting }}
        className="min-h-11 w-full flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5">
        {chatting ? (
          <ActivityIndicator className="text-muted-foreground" />
        ) : (
          <Icon name="chatbubble-outline" size={16} className="text-muted-foreground" />
        )}
        <Text className="text-sm font-semibold text-foreground">
          {chatting ? 'Đang mở...' : 'Nhắn tin với chủ nhà'}
        </Text>
      </Pressable>
    </View>
  );
}
