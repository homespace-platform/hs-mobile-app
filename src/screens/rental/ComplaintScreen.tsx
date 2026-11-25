// Web app/dashboard/complaints/page.tsx: opens one complaint record (the COMPLAINT_* notification target).
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/Screen';
import ComplaintPanel from '@/components/rental/billing/ComplaintPanel';
import { useViewer } from '@/components/rental/requests/useViewer';
import ActionButton from '@/components/rental/shared/ActionButton';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type ComplaintScreenProps = RentalScreenNavProps & {
  rentalRequestId: string;
  initialComplaintId: string;
};

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;

export default function ComplaintScreen({
  rentalRequestId,
  initialComplaintId,
  onBack,
}: ComplaintScreenProps) {
  const { userId, failed, retry } = useViewer();
  const valid = [rentalRequestId, initialComplaintId].every((id) => ID.test(id));
  const message = (text: string) => (
    <Text accessibilityRole="alert" className="text-center text-sm leading-6 text-foreground">
      {text}
    </Text>
  );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Khiếu nại" onBack={onBack} />
      <ScrollView contentContainerClassName="p-4">
        {failed ? (
          <View className="gap-3">
            {message('Vui lòng đăng nhập để xem hồ sơ khiếu nại.')}
            <ActionButton label="Thử lại" variant="secondary" onClick={retry} />
          </View>
        ) : !userId ? (
          message('Đang tải tài khoản…')
        ) : !valid ? (
          message('Đường dẫn hồ sơ khiếu nại không hợp lệ.')
        ) : (
          <ComplaintPanel
            rentalRequestId={rentalRequestId}
            initialComplaintId={initialComplaintId}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
