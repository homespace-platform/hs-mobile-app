// Web /rent alert banner: shown when the listing is not an ordinary public one.
import { Text, View } from 'react-native';

import { PolicyNotice } from '@/components/PolicyDialog';
import { useRentalHoldMinutes } from '@/components/rental/requests/useRentalHoldMinutes';
import { listingStatus } from '@/lib/listing-manage';

/** Its own component, so the hold policy is only read for a reserved listing. */
function ReservedBanner() {
  const minutes = useRentalHoldMinutes();
  return (
    <View className="gap-1 rounded-2xl bg-warning-soft p-4">
      <Text className="text-sm font-bold text-warning">Tin đăng đang trong thời gian giữ chỗ</Text>
      <Text className="text-xs leading-5 text-muted-foreground">
        Tin đang được giữ cho một yêu cầu thuê.{' '}
        {minutes ? `Hạn thanh toán giữ chỗ ban đầu là ${minutes} phút; nếu` : 'Nếu'} cọc đã được xác
        nhận, xem tiến trình nhận nhà để biết bước tiếp theo.
      </Text>
    </View>
  );
}

export default function ListingStatusBanner({
  status,
  isOwner,
}: {
  status: string;
  isOwner: boolean;
}) {
  if (!status || status === 'PUBLISHED') return null;
  if (status === 'RESERVED') return <ReservedBanner />;
  const reason = isOwner
    ? 'Bạn có quyền xem với tư cách chủ tin đăng.'
    : 'Bạn có quyền xem vì có yêu cầu thuê liên quan. Quyền xem này không cấp quyền chỉnh sửa hoặc gửi yêu cầu thuê mới khi tin không còn nhận khách.';
  return (
    <View className="gap-2 rounded-2xl border border-primary-border bg-primary-soft p-4">
      <Text className="text-sm font-bold text-primary">
        {isOwner ? 'Xem trước tin đăng' : 'Tin đăng liên quan đến yêu cầu thuê của bạn'} (
        {listingStatus(status).label})
      </Text>
      <PolicyNotice
        tone="neutral"
        title="Quyền xem tin đăng"
        summary={reason}
        text={reason + ' Tin hiện không hiển thị công khai.'}
      />
    </View>
  );
}
