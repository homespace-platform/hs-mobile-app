import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Ionicons from '@/components/Icon';
import {
  formatVndPrice,
  isUnlimitedMembership,
  planCardStatus,
  planFeatures,
  type MembershipPlanInfo,
} from '@/lib/membership';
import type { MembershipView } from '@/services/membershipApi';

function PlanCard({
  plan,
  membership,
  unlimited,
  onPurchase,
}: {
  plan: MembershipPlanInfo;
  membership: MembershipView | null;
  unlimited: boolean;
  onPurchase: (tier: string) => void;
}) {
  const oneTime = plan.durationDays <= 0;
  const status = planCardStatus(plan, membership, unlimited);
  return (
    <View
      className={`rounded-3xl border bg-surface p-5 ${plan.isPopular ? 'border-2 border-primary' : 'border-border'}`}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-xs font-extrabold uppercase tracking-wider text-primary">
            {plan.shortName}
          </Text>
          {status.current ? (
            <View className="rounded-full bg-success-soft px-2.5 py-0.5">
              <Text className="text-xs font-bold text-success">Đang sử dụng</Text>
            </View>
          ) : null}
        </View>
        {plan.badge ? (
          <View
            className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${plan.isPopular ? 'bg-brand' : 'bg-inverse'}`}>
            <Ionicons
              name="sparkles"
              size={12}
              className={plan.isPopular ? 'text-on-brand' : 'text-on-inverse'}
            />
            <Text
              className={`text-xs font-bold ${plan.isPopular ? 'text-on-brand' : 'text-on-inverse'}`}>
              {plan.badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-1.5 text-base font-bold text-foreground">{plan.name}</Text>
      <Text className="mt-1 text-xs leading-5 text-muted-foreground">{plan.tagline}</Text>
      <View className="mt-4 rounded-2xl border border-border bg-muted p-4">
        {/* One Text with a nested unit: a separate row child was clipped to "/30" on Android. */}
        <Text className="text-2xl font-extrabold text-foreground">
          {formatVndPrice(plan.priceVnd)}
          <Text className="text-xs font-semibold text-muted-foreground">
            {oneTime ? ' / một lần' : ` / ${plan.durationDays} ngày`}
          </Text>
        </Text>
        <Text className="mt-2 border-t border-border pt-2 text-xs font-bold text-foreground">
          {plan.publicationUses} lượt đăng tin
        </Text>
      </View>
      <View className="mt-4 gap-2.5">
        {planFeatures(plan).map((feature) => (
          <View key={feature} className="flex-row items-start gap-2">
            <View className="mt-0.5 h-4 w-4 items-center justify-center rounded-full bg-primary-soft">
              <Ionicons name="checkmark" size={11} className="text-primary" />
            </View>
            <Text className="flex-1 text-xs leading-5 text-foreground">{feature}</Text>
          </View>
        ))}
      </View>
      <View className="mt-5 border-t border-border pt-4">
        {status.kind === 'purchase' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onPurchase(plan.code)}
            className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 active:opacity-80">
            <Text className="shrink text-center text-xs font-bold text-on-brand">
              {status.label}
            </Text>
            <Ionicons name="open-outline" size={16} className="text-on-brand" />
          </Pressable>
        ) : (
          <View
            className={`flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 ${status.kind === 'unlimited' ? 'border-primary-border bg-primary-soft' : 'border-border bg-muted'}`}>
            {status.kind === 'unlimited' ? (
              <Ionicons name="infinite" size={16} className="text-primary" />
            ) : null}
            <Text
              className={`shrink text-center text-xs font-bold ${status.kind === 'unlimited' ? 'text-primary' : 'text-muted-foreground'}`}>
              {status.label}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// "Xem chi tiết bảng gói" / "Quản lý gói của tôi" are omitted: the app has no membership screen yet.
export default function MembershipSection({
  plans,
  membership,
  role,
  onPostListing,
  onPurchase,
}: {
  plans: MembershipPlanInfo[] | null;
  membership: MembershipView | null;
  role?: string | null;
  onPostListing: () => void;
  onPurchase: (tier: string) => void;
}) {
  const unlimited = isUnlimitedMembership(membership, role);
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
        Mỗi tài khoản mới có sẵn{' '}
        <Text className="font-semibold text-foreground">3 lượt đăng tin miễn phí</Text> dùng một
        lần. Tạo nháp và chỉnh sửa bài đăng hoàn toàn miễn phí — linh hoạt mua hoặc nâng cấp gói 30
        ngày qua SePay khi cần mở rộng quy mô.
      </Text>
      <Text className="mt-2 text-xs leading-5 text-muted-foreground">
        Khi thanh toán trên website, hãy dùng cùng tài khoản HomeSpace.
      </Text>
      <Pressable
        onPress={onPostListing}
        accessibilityRole="button"
        className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand">
        <Ionicons name="add-circle-outline" size={18} className="text-on-brand" />
        <Text className="font-bold text-on-brand">Đăng tin ngay</Text>
      </Pressable>

      <View className="mt-5 gap-4">
        {plans ? (
          plans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              membership={membership}
              unlimited={unlimited}
              onPurchase={onPurchase}
            />
          ))
        ) : (
          <ActivityIndicator className="text-primary" />
        )}
      </View>
    </View>
  );
}
