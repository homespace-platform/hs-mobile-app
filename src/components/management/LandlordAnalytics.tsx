import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { getLandlordAnalytics } from '@/services/dashboardApi';
import {
  dashboardDate as date,
  dashboardMoney as money,
  dashboardMonthRangeError,
} from '@/lib/dashboard-summary';
import {
  ActionRow,
  Empty,
  Metric,
  Refresh,
  Section,
  statusLabel,
  useDashboardData,
} from './DashboardUi';

const inputClass =
  'min-h-12 rounded-xl border border-border bg-surface px-3 text-foreground placeholder:text-subtle';

export default function LandlordAnalytics({ onAction }: { onAction: (href: string) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [query, setQuery] = useState<Record<string, string | number>>({});
  const load = useCallback((signal: AbortSignal) => getLandlordAnalytics(signal, query), [query]);
  const { data: d, ...state } = useDashboardData(load);
  useEffect(() => {
    if (d && !query.from) {
      setFrom(d.from);
      setTo(d.to);
    }
  }, [d, query.from]);

  function apply() {
    const error = dashboardMonthRangeError(from, to);
    if (error) {
      setRangeError(error);
      return;
    }
    setRangeError(null);
    setQuery({ from, to, listingPage: 1 });
  }
  const reportHref = `/dashboard/analytics${d ? `?from=${d.from}&to=${d.to}` : ''}`;
  return (
    <View className="gap-4">
      <Section title="Khoảng báo cáo">
        <Text className="text-sm leading-5 text-muted-foreground">
          Mặc định theo kỳ thuê của hệ thống. Mỗi lần xem tối đa 24 tháng.
        </Text>
        <Text className="text-sm font-semibold text-foreground">Từ tháng (YYYY-MM)</Text>
        <TextInput
          accessibilityLabel="Từ tháng, dạng YYYY-MM"
          value={from}
          onChangeText={setFrom}
          placeholder="2026-01"
          autoCapitalize="none"
          className={inputClass}
        />
        <Text className="text-sm font-semibold text-foreground">Đến tháng (YYYY-MM)</Text>
        <TextInput
          accessibilityLabel="Đến tháng, dạng YYYY-MM"
          value={to}
          onChangeText={setTo}
          placeholder="2026-11"
          autoCapitalize="none"
          className={inputClass}
        />
        {rangeError ? (
          <Text accessibilityRole="alert" className="text-sm text-danger">
            {rangeError}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={apply}
          className="min-h-12 items-center justify-center rounded-xl bg-brand px-4">
          <Text className="font-semibold text-on-brand">Áp dụng</Text>
        </Pressable>
        <ActionRow
          title="Biểu đồ và xuất báo cáo trên web"
          detail="Mở phân tích đầy đủ để xem biểu đồ, lọc theo chi nhánh hoặc tin đăng và xuất CSV/PDF."
          href={reportHref}
          onAction={onAction}
        />
      </Section>
      <Refresh {...state} hasData={!!d} />
      {d ? (
        <>
          <Text className="text-xs text-muted-foreground">
            {d.from} → {d.to} · Hạn theo kỳ thuê ngày {date(d.billingNow)}
          </Text>
          <Section title="Doanh thu theo tháng">
            <Text className="text-sm text-muted-foreground">
              Đã nhận và đã hoàn không gồm tiền cọc.
            </Text>
            {d.revenue.map((item) => (
              <View key={item.month} className="gap-2 rounded-xl bg-muted p-3">
                <Text className="font-bold text-foreground">
                  {item.month.split('-').reverse().join('/')}
                </Text>
                <Metric label="Đã nhận" value={money(item.receivedVnd)} />
                <Metric label="Đã hoàn" value={money(item.refundedVnd)} />
                <Metric label="Doanh thu ròng" value={money(item.netVnd)} />
                <Metric label="Đến hạn trong kỳ" value={money(item.dueVnd)} />
                <Metric label="Đã thu của kỳ" value={money(item.dueCollectedVnd)} />
                <Metric label="Thu muộn" value={money(item.lateCollectedVnd)} />
                <Metric label="Phí chậm" value={money(item.lateFeeVnd)} />
                <Metric label="Nợ chuyển kỳ" value={money(item.rolledOverVnd)} />
                <Metric label="Chi phí hội viên" value={money(item.membershipFeeVnd)} />
              </View>
            ))}
          </Section>
          <Section title="Tỉ lệ lấp đầy">
            {d.occupancy.length ? (
              d.occupancy.map((item) => (
                <Metric
                  key={item.month}
                  label={`${item.month.split('-').reverse().join('/')} · ${item.rooms} phòng`}
                  value={
                    item.rate == null
                      ? 'Chưa có dữ liệu'
                      : `${(Number(item.rate) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
                  }
                />
              ))
            ) : (
              <Empty text="Chưa có phòng liên kết để tính lấp đầy." />
            )}
          </Section>
          <Section title="Công nợ">
            <Metric
              label={`${d.receivables.count} khoản quá hạn`}
              value={money(d.receivables.totalVnd)}
            />
            {d.receivables.buckets.map((item) => (
              <Metric
                key={item.key}
                label={`${({ D0_7: '0–7 ngày', D8_30: '8–30 ngày', D31_PLUS: 'Trên 30 ngày' } as Record<string, string>)[item.key] || 'Quá hạn'} · ${item.count} khoản`}
                value={money(item.vnd)}
              />
            ))}
            {d.receivables.top.map((item) => (
              <ActionRow
                key={item.paymentId}
                title={item.contractNumber || 'Khoản thanh toán'}
                detail={`${money(item.amountVnd)} · ${item.daysLate} ngày quá hạn`}
                href={item.href}
                onAction={onAction}
              />
            ))}
          </Section>
          <Section title="Khách quan tâm">
            <Metric
              label={d.funnel.views.cumulative ? 'Lượt xem cộng dồn' : 'Lượt xem trong khoảng'}
              value={d.funnel.views.value}
            />
            <Metric label="Hẹn xem" value={d.funnel.appointments} />
            <Metric label="Yêu cầu thuê" value={d.funnel.requests} />
            <Metric label="Hợp đồng" value={d.funnel.contracts} />
            <Text className="text-xs leading-5 text-muted-foreground">
              {d.funnel.views.since
                ? `Lượt xem theo ngày có từ ${date(d.funnel.views.since)}.`
                : 'Chưa có dữ liệu lượt xem theo ngày, đang hiển thị tổng lượt xem đã lưu.'}
            </Text>
          </Section>
          <Section title="Hiệu quả tin đăng">
            {d.listings.items.length ? (
              d.listings.items.map((item) => (
                <ActionRow
                  key={item.id}
                  title={item.title}
                  detail={`${statusLabel(item.status)} · ${item.viewsInRange ?? '—'} lượt xem trong khoảng · ${item.appointments} hẹn · ${item.requests} yêu cầu · ${item.favorites} lượt lưu${item.noLeads ? ' · Chưa có khách quan tâm' : ''}`}
                  href={`/dashboard/properties/view?id=${encodeURIComponent(item.id)}`}
                  onAction={onAction}
                />
              ))
            ) : (
              <Empty text="Chưa có tin đăng trong phạm vi này." />
            )}
            <Metric label="Trang" value={`${d.listings.page} · ${d.listings.total} tin`} />
            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                disabled={state.loading || d.listings.page <= 1}
                onPress={() => setQuery((q) => ({ ...q, listingPage: d.listings.page - 1 }))}
                className={`min-h-12 flex-1 items-center justify-center rounded-xl border border-border ${d.listings.page <= 1 ? 'opacity-40' : ''}`}>
                <Text className="font-semibold text-primary">Trang trước</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={state.loading || d.listings.page * d.listings.size >= d.listings.total}
                onPress={() => setQuery((q) => ({ ...q, listingPage: d.listings.page + 1 }))}
                className={`min-h-12 flex-1 items-center justify-center rounded-xl border border-border ${d.listings.page * d.listings.size >= d.listings.total ? 'opacity-40' : ''}`}>
                <Text className="font-semibold text-primary">Trang sau</Text>
              </Pressable>
            </View>
          </Section>
        </>
      ) : null}
    </View>
  );
}
