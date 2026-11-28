import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import { checkKyc } from '@/components/appointment/booking/booking-flow';
import Icon from '@/components/Icon';
import {
  ctaState,
  RENTAL_HOLD_DURATION_LABEL,
  runRentalCta,
} from '@/components/rental/requests/logic';
import { startKyc } from '@/lib/kyc/client';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { getUserProfileApi } from '@/services/userApi';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

// Visitor call-to-action block of the web overview card. As on web, the negotiation button only
// opens a dialog.
export default function ContactCta({
  status,
  publicListing,
  isNegotiable,
  isOwner,
  rentalRequest,
  hasActiveBooking,
  chatting,
  onChat,
  onOpenRequests,
  onOpenBookings,
  onBook,
  onRequestRental,
}: {
  status?: string;
  publicListing: boolean;
  isNegotiable: boolean;
  isOwner: boolean;
  rentalRequest: RentalRequestResponse | null;
  hasActiveBooking: boolean;
  chatting: boolean;
  onChat: () => void;
  onOpenRequests: () => void;
  onOpenBookings: () => void;
  /** Called once the permission and KYC gates pass. */
  onBook: () => void;
  /** Called once the owner, permission/profile and KYC gates pass. */
  onRequestRental: () => void;
}) {
  const showDialog = useDialog();
  const ownerNotice = (message: string) => showDialog('Thông báo', message);
  const bookingDisabled = !publicListing && !hasActiveBooking;
  const bookGate = useFeatureGate(PERMISSIONS.APPOINTMENT_BOOK);
  const rentalGate = useFeatureGate(PERMISSIONS.RENTAL_REQUEST_CREATE);
  const cta = ctaState(rentalRequest?.status, status);
  const [checkingKyc, setCheckingKyc] = useState(false);
  const [checkingRental, setCheckingRental] = useState(false);
  const checking = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function openBooking() {
    if (checking.current || !bookGate.guard()) return;
    checking.current = true;
    setCheckingKyc(true);
    const kyc = await checkKyc(getUserProfileApi);
    checking.current = false;
    if (!mounted.current) return;
    setCheckingKyc(false);
    if (kyc === 'verified') return onBook();
    explainKyc(kyc);
  }

  function explainKyc(kyc: 'unverified' | 'unavailable') {
    if (kyc === 'unavailable') {
      return showDialog(
        'Thông báo',
        'Đang tải thông tin tài khoản. Vui lòng thử lại trong giây lát.'
      );
    }
    showDialog('Thông báo', 'Vui lòng xác minh danh tính (KYC) trước khi thực hiện thao tác này.', [
      { text: 'Đóng', style: 'cancel' },
      { text: 'Xác minh ngay', onPress: () => void startKyc() },
    ]);
  }

  async function openRentalForm() {
    if (checking.current) return;
    checking.current = true;
    const outcome = await runRentalCta({
      isOwner,
      guard: rentalGate.guard,
      checkKyc: () => {
        setCheckingRental(true);
        return checkKyc(getUserProfileApi);
      },
    });
    checking.current = false;
    if (!mounted.current) return;
    setCheckingRental(false);
    if (outcome === 'owner')
      return ownerNotice('Bạn là chủ bài đăng này, không thể tự gửi yêu cầu thuê.');
    if (outcome === 'verified') return onRequestRental();
    if (outcome !== 'locked') explainKyc(outcome);
  }

  return (
    <View className="mt-5 gap-3 border-t border-border pt-5">
      <Text className="text-base font-bold text-foreground">Bạn quan tâm đến căn này?</Text>

      {cta === 'pending' || cta === 'accepted' ? (
        <View className="items-center gap-2">
          <Pressable
            onPress={onOpenRequests}
            accessibilityRole="button"
            accessibilityHint={
              cta === 'pending'
                ? 'Xem yêu cầu thuê đang chờ duyệt của bạn'
                : `Yêu cầu thuê đã được duyệt và đang giữ chỗ trong ${RENTAL_HOLD_DURATION_LABEL}! Bấm để xem chi tiết`
            }
            className={`min-h-12 w-full flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3.5 ${cta === 'pending' ? 'border-warning bg-warning-soft' : 'border-success bg-success-soft'}`}>
            <Icon
              name={cta === 'pending' ? 'time-outline' : 'checkmark-circle'}
              size={18}
              className={cta === 'pending' ? 'text-warning' : 'text-success'}
            />
            <Text
              className={`shrink text-sm font-bold ${cta === 'pending' ? 'text-warning' : 'text-success'}`}>
              {cta === 'pending'
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
      ) : cta === 'reserved' ? (
        <View
          accessible
          accessibilityRole="button"
          accessibilityHint={`Địa điểm cho thuê này đang được giữ chỗ trong ${RENTAL_HOLD_DURATION_LABEL} cho một khách thuê khác`}
          accessibilityState={{ disabled: true }}
          className="min-h-12 w-full flex-row items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-3.5">
          <Icon name="shield-checkmark-outline" size={18} className="text-muted-foreground" />
          <Text className="text-sm font-bold text-muted-foreground">Đang giữ chỗ (Tạm khóa)</Text>
        </View>
      ) : cta === 'closed' ? (
        <View className="rounded-xl border border-border bg-muted p-3">
          <Text className="text-center text-sm font-medium text-muted-foreground">
            Tin hiện không nhận yêu cầu thuê mới
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() => void openRentalForm()}
          accessibilityRole="button"
          accessibilityHint={rentalGate.title ?? 'Gửi yêu cầu thuê nhà trực tiếp tới chủ nhà'}
          accessibilityState={{ busy: checkingRental }}
          className="min-h-12 w-full flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5">
          {checkingRental ? (
            <ActivityIndicator className="text-on-brand" />
          ) : (
            <Icon name="home-outline" size={18} className="text-on-brand" />
          )}
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
            void openBooking();
          }}
          accessibilityRole="button"
          accessibilityHint={
            bookGate.title ?? 'Đặt lịch gặp trực tiếp chủ nhà tại địa điểm cho thuê'
          }
          accessibilityState={{ disabled: bookingDisabled, busy: checkingKyc }}
          className={`min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 ${hasActiveBooking ? 'border-success bg-success-soft' : 'border-border bg-surface'} ${bookingDisabled ? 'opacity-50' : ''}`}>
          {checkingKyc ? (
            <ActivityIndicator className="text-primary" />
          ) : (
            <Icon
              name={hasActiveBooking ? 'checkmark-circle' : 'calendar-outline'}
              size={16}
              className={hasActiveBooking ? 'text-success' : 'text-primary'}
            />
          )}
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
