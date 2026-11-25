// Mobile counterpart of hs-web-app components/rental-request/RentalCostSummary.tsx.
import { ActivityIndicator, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { formatVND } from '@/lib/rental/rental-request.helper';
import type { RentalEstimateResponse } from '@/types/rental/rental-request.type';

import EndOfPeriodCharges from './EndOfPeriodCharges';
import InfoRow from './InfoRow';
import { PolicyNotice } from './PolicyNotice';

const BODY = 'text-sm leading-6 text-secondary';
const NOTE = 'text-xs leading-5 text-muted-foreground';

const dateLabel = (value: string) => value.split('-').reverse().join('/');

export default function RentalCostSummary({
  estimate,
  loading,
  error,
  depositBadge,
}: {
  estimate: RentalEstimateResponse | null;
  loading: boolean;
  error: string | null;
  depositBadge: string;
  /** Unused, as on web. */
  occupantCount?: number;
}) {
  if (loading || error || !estimate || !estimate.paymentPlan) {
    return (
      <View
        accessibilityLiveRegion="polite"
        className="gap-2 rounded-2xl border border-border bg-surface p-4">
        <View className="flex-row items-center gap-2">
          {loading ? (
            <ActivityIndicator size="small" className="text-primary" />
          ) : (
            <Icon name="alert-circle-outline" size={18} className="text-danger" />
          )}
          <Text className="flex-1 text-sm font-bold text-foreground">
            {loading ? 'Đang tính lịch thanh toán...' : 'Chưa thể xác định khoản thanh toán'}
          </Text>
        </View>
        {error ? <Text className="text-sm leading-6 text-danger">{error}</Text> : null}
        {!loading && !error && estimate && !estimate.paymentPlan ? (
          <Text className="text-sm leading-6 text-muted-foreground">
            Chưa có lịch thanh toán từ hệ thống. Vui lòng tải lại dự toán trước khi gửi yêu cầu.
          </Text>
        ) : null}
      </View>
    );
  }

  const plan = estimate.paymentPlan;
  const rent = plan.firstRentAmount;
  const deposit = estimate.depositAmount;

  return (
    <View className="gap-3">
      <View className="rounded-2xl border-2 border-primary-border bg-surface p-4">
        <View className="border-b border-border pb-3">
          <View className="flex-row items-center gap-2">
            <Icon name="shield-checkmark-outline" size={18} className="text-primary" />
            <Text accessibilityRole="header" className="flex-1 text-base font-bold text-foreground">
              {plan.depositOnly
                ? deposit === 0
                  ? 'Không yêu cầu đặt cọc'
                  : 'Đặt cọc trước ngày nhận nhà'
                : 'Thanh toán ban đầu'}
            </Text>
          </View>
          <Text className={`mt-1 ${NOTE}`}>
            {plan.depositOnly
              ? deposit === 0
                ? 'Bỏ qua chuyển cọc và ký hợp đồng cọc. Tiền thuê tháng đầu mở vào ngày bắt đầu thuê.'
                : 'Sau khi chủ nhà chấp thuận, chỉ thanh toán tiền cọc giữ chỗ. Chưa thu tiền thuê tháng đầu.'
              : deposit === 0
                ? 'Dọn vào cùng ngày: chỉ thanh toán tiền thuê tháng đầu và ký hợp đồng thuê, bỏ qua hợp đồng cọc.'
                : 'Dọn vào cùng ngày: thanh toán tiền cọc và tiền thuê tháng đầu sau khi chủ nhà chấp thuận yêu cầu.'}
          </Text>
        </View>

        <View className="py-2">
          {!plan.depositOnly ? <InfoRow label="Tiền thuê kỳ đầu" value={formatVND(rent)} /> : null}
          <InfoRow
            label={`Tiền đặt cọc ${deposit > 0 ? `(${depositBadge})` : '(không có)'}`}
            value={formatVND(deposit)}
          />
        </View>

        <View className="border-t border-border pt-2">
          <InfoRow
            label={
              plan.depositOnly
                ? 'Cọc cần thanh toán sau khi được duyệt'
                : 'Tổng cần thanh toán ban đầu'
            }
            value={formatVND(plan.amountAfterApproval)}
            strong
          />
        </View>
        <Text className={`mt-1 ${NOTE}`}>
          {plan.depositOnly && deposit === 0
            ? 'Bạn được miễn cọc, không cần chuyển tiền giữ chỗ. '
            : 'Chuyển trực tiếp cho chủ nhà. '}
          HomeSpace không nhận hoặc giữ tiền.
        </Text>
      </View>

      {plan.depositOnly ? (
        <View className="gap-2 rounded-2xl border border-border bg-surface p-4">
          <Text className="text-sm font-bold text-foreground">
            Tiền thuê tháng đầu — thanh toán sau
          </Text>
          <InfoRow
            label={`Mở thanh toán từ ${dateLabel(plan.firstRentOpensOn)}`}
            value={formatVND(rent)}
          />
          <PolicyNotice
            tone="neutral"
            title="Thanh toán tiền phòng tháng đầu"
            summary="Hệ thống mở thanh toán tiền phòng tháng đầu vào ngày bắt đầu dọn vào.">
            <Text className={BODY}>
              Đến ngày bắt đầu dọn vào {dateLabel(plan.moveInDate)}, hệ thống mới mở thanh toán tiền
              phòng tháng đầu. Không thu lại khoản cọc đã xác nhận. Ký hợp đồng mở sau khi đã xác
              nhận đủ tiền theo tiến trình nhận nhà.
            </Text>
          </PolicyNotice>
        </View>
      ) : null}
      <PolicyNotice
        tone="neutral"
        title="Về dự toán chi phí"
        summary="Khoản cần thanh toán được xác định lại khi chủ nhà chấp thuận.">
        <Text className={BODY}>
          Dự toán theo ngày {dateLabel(plan.businessDate)} của hệ thống. Khoản cần thanh toán được
          xác định lại khi chủ nhà chấp thuận; nếu thời điểm đó trùng ngày dọn vào thì thu cọc +
          tháng đầu. Ngày thuê có thể thay đổi nếu hai bên đồng ý bắt đầu sớm.
        </Text>
      </PolicyNotice>

      <EndOfPeriodCharges
        predictableCharges={estimate.predictableCharges}
        excludedCharges={estimate.excludedCharges}
      />
    </View>
  );
}
