// Web components/home/LandlordCta: the same plan cards and rules as the membership screen.
import { Text, View } from 'react-native';
import Ionicons from '@/components/Icon';
import MembershipPlanCard from '@/components/membership/MembershipPlanCard';
import ActionButton from '@/components/rental/shared/ActionButton';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import type { MembershipPlanInfo, PlanCardState } from '@/lib/membership';

export default function MembershipSection({
  plans,
  error,
  cardState,
  onRetry,
  onPostListing,
  onOpenMembership,
}: {
  plans: MembershipPlanInfo[] | null;
  error: string | null;
  cardState: (plan: MembershipPlanInfo) => PlanCardState;
  onRetry: () => void;
  onPostListing: () => void;
  /** With a tier, the membership screen opens that plan's checkout. */
  onOpenMembership: (tier?: string) => void;
}) {
  const free = plans?.find((plan) => plan.code === 'FREE');
  return (
    <View className="mt-8 px-5">
      <View className="flex-row items-center gap-2">
        <Ionicons name="ribbon-outline" size={16} className="text-primary" />
        <Text className="flex-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Dành cho Chủ nhà & Đơn vị cho thuê
        </Text>
      </View>
      <Text className="mt-2 text-xl font-bold text-foreground">
        Bảng gói hội viên & Lượt đăng tin cho thuê
      </Text>
      <Text className="mt-2 text-sm leading-5 text-muted-foreground">
        {free ? (
          <>
            Gói Free trọn đời có{' '}
            <Text className="font-semibold text-foreground">
              {free.publicationUses} lượt đăng tin miễn phí
            </Text>{' '}
            mỗi {free.durationDays || 30} ngày (không cộng dồn).{' '}
          </>
        ) : null}
        Tạo nháp và chỉnh sửa bài đăng hoàn toàn miễn phí — linh hoạt mua hoặc nâng cấp gói khi cần
        mở rộng quy mô.
      </Text>
      <ActionButton
        label="Đăng tin ngay"
        icon="add-circle-outline"
        className="mt-4"
        onClick={onPostListing}
      />
      <ActionButton
        label="Quản lý gói của tôi"
        variant="secondary"
        className="mt-2"
        onClick={() => onOpenMembership()}
      />

      <View className="mt-5 gap-4">
        {error ? <ErrorBlock message={error} onRetry={onRetry} /> : null}
        {plans ? (
          plans.map((plan) => (
            <MembershipPlanCard
              key={plan.code}
              plan={plan}
              state={cardState(plan)}
              onSelect={(selected) => onOpenMembership(selected.code)}
            />
          ))
        ) : !error ? (
          <LoadingBlock label="Đang tải bảng giá..." />
        ) : null}
      </View>
    </View>
  );
}
