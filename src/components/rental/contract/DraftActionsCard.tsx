// Web: components/contract/page/DraftActionsCard.tsx. Save and "update from listing" live only in
// the pinned draft bar, so they are not repeated here.
import { Pressable, Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { Card, SectionTitle } from '@/components/rental/shared/Card';

import { linkText } from './fields';

export default function DraftActionsCard({
  dirty,
  conflict,
  signatureLocked,
  missingMeters,
  onReviewContent,
  onReload,
}: {
  dirty: boolean;
  conflict: boolean;
  signatureLocked: boolean;
  missingMeters: boolean;
  onReviewContent: () => void;
  onReload: () => void;
}) {
  const steps = [
    `Rà soát và sửa nội dung trong mục Nội dung hợp đồng${missingMeters ? ' (còn thiếu chỉ số điện nước)' : ''}.`,
    'Bấm Lưu ở thanh cố định phía dưới để tạo PDF xem trước.',
    'Kiểm tra PDF rồi gửi cho người thuê hoặc ký số.',
  ];
  return (
    <Card className="gap-3">
      <SectionTitle
        title="Hoàn thiện bản nháp"
        hint="Rà soát nội dung, lưu ở thanh dưới màn hình để tạo PDF, rồi gửi hoặc ký."
      />
      <View className="gap-1.5">
        {steps.map((step, index) => (
          <View key={step} className="flex-row gap-2">
            <Text className="text-sm font-bold leading-6 text-foreground">{index + 1}.</Text>
            <Text className="flex-1 text-sm leading-6 text-foreground">{step}</Text>
          </View>
        ))}
      </View>
      {dirty ? (
        <Text accessibilityLiveRegion="polite" className="text-sm font-semibold text-warning">
          Có thay đổi chưa lưu
        </Text>
      ) : null}
      {signatureLocked ? (
        <Text className="text-sm leading-6 text-warning">
          Bản nháp đang xử lý chữ ký. Theo dõi trạng thái ở phần ký bên dưới.
        </Text>
      ) : null}
      {conflict ? <DraftConflictNotice onReload={onReload} /> : null}
      <ActionButton
        label="Rà soát nội dung"
        variant="secondary"
        icon="create-outline"
        onClick={onReviewContent}
      />
    </Card>
  );
}

export function DraftConflictNotice({ onReload }: { onReload: () => void }) {
  return (
    <View accessibilityRole="alert" className="gap-1">
      <Text className="text-sm leading-6 text-warning">
        Bản nháp đã thay đổi ở nơi khác. Hãy đối chiếu nội dung trước khi chỉnh sửa lại.
      </Text>
      <Pressable
        onPress={onReload}
        accessibilityRole="button"
        className="min-h-11 justify-center self-start">
        <Text className={linkText}>Tải lại bản nháp</Text>
      </Pressable>
    </View>
  );
}
