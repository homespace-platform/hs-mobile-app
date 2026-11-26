// Web components/membership/MembershipPlanCard.
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { formatVndPrice, type MembershipPlanInfo, type PlanCardState } from '@/lib/membership';

export default function MembershipPlanCard({
  plan,
  state,
  requested,
  onSelect,
}: {
  plan: MembershipPlanInfo;
  state: PlanCardState;
  /** The plan the user came here to buy. */
  requested?: boolean;
  onSelect: (plan: MembershipPlanInfo) => void;
}) {
  // As web, only the recommended plan shows its badge.
  const recommended = plan.code === 'PRO';
  const highlighted = recommended || requested;
  const free = plan.code === 'FREE';
  const days = plan.durationDays || 30;
  return (
    <View
      className={`gap-3 rounded-2xl bg-surface p-4 ${highlighted ? 'border-2 border-primary' : state.isCurrent ? 'border-2 border-border-strong' : 'border border-border'}`}>
      {state.isCurrent || recommended ? (
        <View className="flex-row flex-wrap gap-2">
          {state.isCurrent ? (
            <View className="rounded-full bg-inverse px-3 py-1">
              <Text className="text-xs font-semibold text-on-inverse">Đang sử dụng</Text>
            </View>
          ) : null}
          {recommended ? (
            <View className="rounded-full bg-brand px-3 py-1">
              <Text className="text-xs font-semibold text-on-brand">{plan.badge}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
          {plan.shortName}
        </Text>
        <Text className="text-sm leading-5 text-muted-foreground">{plan.tagline}</Text>
      </View>
      {/* One Text with a nested unit: a separate row child was clipped on Android. */}
      <Text className="text-2xl font-bold text-foreground">
        {formatVndPrice(plan.priceVnd)}
        <Text className="text-sm font-normal text-muted-foreground">
          {free ? ' / trọn đời' : ` / ${days} ngày`}
        </Text>
      </Text>
      <View className="gap-1 border-t border-border pt-3">
        <Text className="text-base font-semibold text-foreground">
          {plan.publicationUses} lượt đăng tin{free ? ` mỗi ${days} ngày` : ''}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {state.perUseCost > 0
            ? `Khoảng ${state.perUseCost.toLocaleString('vi-VN')} ₫/lượt`
            : `Hồi lại mỗi ${days} ngày, không cộng dồn`}
        </Text>
      </View>
      {state.upgrade ? (
        <Text className="text-sm leading-5 text-success">
          Ưu đãi nâng cấp 24h: chỉ bù{' '}
          <Text className="font-bold">{formatVndPrice(state.upgrade.amountVnd)}</Text>, nhận{' '}
          <Text className="font-bold">{state.upgrade.remainingUsesAfter} lượt</Text>.
        </Text>
      ) : null}
      {state.note ? <Text className="text-sm text-muted-foreground">{state.note}</Text> : null}
      {state.kind === 'buy' ? (
        <ActionButton
          label={state.label}
          variant={highlighted ? 'primary' : 'secondary'}
          onClick={() => onSelect(plan)}
        />
      ) : (
        <View
          accessible
          accessibilityLabel={`${plan.shortName}: ${state.label}`}
          accessibilityState={{ disabled: state.kind === 'blocked' }}
          className="min-h-12 items-center justify-center rounded-xl border border-border bg-muted px-4 py-3">
          <Text className="text-center text-sm font-semibold text-secondary">{state.label}</Text>
        </View>
      )}
    </View>
  );
}
