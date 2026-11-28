import { Text, View } from 'react-native';
import {
  getLandlordSummary,
  getTenantSummary,
  type SummaryAction,
  type SummaryComplaint,
  type LandlordSummary,
  type TenantSummary,
} from '@/services/dashboardApi';
import { dashboardDate as date, dashboardMoney as money } from '@/lib/dashboard-summary';
import { workLabel } from '@/lib/branch-overview';
import {
  ActionRow,
  Empty,
  Metric,
  Refresh,
  Section,
  statusLabel,
  useDashboardData,
} from './DashboardUi';

type Open = (href: string) => void;
const tenantActions: Record<string, string> = {
  SIGN_DEPOSIT: 'Ký thoả thuận cọc',
  SIGN_ANNEX: 'Ký phụ lục',
  SIGN_LEASE: 'Ký hợp đồng',
  PAY_DEPOSIT: 'Thanh toán tiền cọc',
  PAY_FIRST_RENT: 'Thanh toán tiền thuê đầu tiên',
  RESPOND_DEFAULT_NOTICE: 'Phản hồi yêu cầu quá hạn',
  CLOSURE_RESPONSE: 'Phản hồi quyết toán',
  CONFIRM_REFUND: 'Xác nhận nhận tiền hoàn',
  SIGN_CONFIRM_APP: 'Xác nhận ký trên ứng dụng',
  COMPLAINT_RESPOND: 'Phản hồi khiếu nại',
};
const tasks = (items: SummaryAction[], onAction: Open) =>
  items.length ? (
    items.map((item) => (
      <ActionRow
        key={item.key}
        title={tenantActions[item.type] || workLabel(item.type)[1]}
        detail={`${item.contextLabel ? `${item.contextLabel} · ` : ''}${item.priority === 'URGENT' ? 'Ưu tiên · ' : ''}Hạn ${date(item.dueAt, true)}${item.clock === 'BILLING' ? ' · theo kỳ thuê' : ''}`}
        href={item.href}
        onAction={onAction}
      />
    ))
  ) : (
    <Empty />
  );
function Complaints({
  data,
  onAction,
}: {
  data: { openCount: number; dueFromMeCount: number; items: SummaryComplaint[] } | null;
  onAction: Open;
}) {
  return (
    <Section title="Khiếu nại" unavailable={!data}>
      {data ? (
        <>
          <Metric label="Hồ sơ đang mở" value={data.openCount} />
          <Metric label="Chờ bạn phản hồi" value={data.dueFromMeCount} />
          {data.items.map((item) => (
            <ActionRow
              key={item.id}
              title={item.contractNumber || 'Hồ sơ đang xử lý'}
              detail={`${statusLabel(item.status)} · Hạn ${date(item.respondBy)}`}
              href={item.href}
              onAction={onAction}
            />
          ))}
        </>
      ) : null}
    </Section>
  );
}

export function LandlordSummaryView({ onAction }: { onAction: Open }) {
  const state = useDashboardData(getLandlordSummary);
  return (
    <View className="gap-4">
      <Refresh {...state} hasData={!!state.data} />
      {state.data ? <LandlordContent data={state.data} onAction={onAction} /> : null}
    </View>
  );
}
function LandlordContent({ data: d, onAction }: { data: LandlordSummary; onAction: Open }) {
  return (
    <>
      <Text className="text-xs leading-5 text-muted-foreground">
        Kỳ {d.month.split('-').reverse().join('/')} · Hạn thuê theo ngày {date(d.billingNow)}
      </Text>
      {d.setup && !d.setup.hasReceivingAccount ? (
        <Section title="Hoàn thiện thiết lập">
          <ActionRow
            title="Thêm tài khoản nhận tiền"
            href="/dashboard/settings?section=bank-accounts"
            onAction={onAction}
          />
        </Section>
      ) : null}
      <Section title="Việc cần làm" unavailable={!d.todo}>
        {d.todo ? (
          <>
            <Metric label="Tổng số việc" value={d.todo.total} />
            <Metric label="Cần ưu tiên" value={d.todo.urgent} />
            {tasks(d.todo.items, onAction)}
          </>
        ) : null}
      </Section>
      <Section title="Tiền trong kỳ" unavailable={!d.revenue}>
        {d.revenue ? (
          <>
            <Metric label="Đã nhận, chưa gồm cọc" value={money(d.revenue.receivedVnd)} />
            <Metric label="Đã hoàn, chưa gồm cọc" value={money(d.revenue.refundedVnd)} />
            <Metric label="Dự kiến thu" value={money(d.revenue.expectedVnd)} />
            <Metric
              label={`Quá hạn · ${d.revenue.overdueCount} khoản`}
              value={money(d.revenue.overdueVnd)}
            />
            <Metric label="Cọc đã nhận trong kỳ" value={money(d.revenue.depositReceivedVnd)} />
            <Metric
              label={`Chờ xác nhận · ${d.revenue.awaitingConfirm.count} khoản`}
              value={money(d.revenue.awaitingConfirm.vnd)}
            />
            <Metric
              label={`Bị từ chối · ${d.revenue.rejected.count} khoản`}
              value={money(d.revenue.rejected.vnd)}
            />
            <Metric
              label={`Cần hoàn · ${d.revenue.refundsOwed.count} khoản`}
              value={money(d.revenue.refundsOwed.vnd)}
            />
            <Metric label="Thu muộn từ kỳ trước" value={money(d.revenue.lateFromPreviousVnd)} />
            <Metric label="Phí chậm thanh toán" value={money(d.revenue.lateFeeVnd)} />
            <Metric label="Nợ chuyển kỳ" value={money(d.revenue.rolledOverVnd)} />
            {d.revenue.receiptPdfIssues ? (
              <Text className="text-sm text-warning">
                {d.revenue.receiptPdfIssues} phiếu thu đang chờ xử lý PDF
              </Text>
            ) : null}
            <ActionRow title="Lịch sử thanh toán" href="/dashboard/payments" onAction={onAction} />
          </>
        ) : null}
      </Section>
      <Section title="Hợp đồng" unavailable={!d.contracts}>
        {d.contracts ? (
          <>
            {Object.entries(d.contracts.byStatus).map(([status, count]) => (
              <Metric key={status} label={statusLabel(status)} value={count} />
            ))}
            <Metric
              label="Đã kết thúc, chưa tất toán"
              value={d.contracts.closures.endedNotClosed}
            />
            <Metric label="Chờ hoàn cọc" value={money(d.contracts.closures.refundVnd)} />
            <Metric label="Lỗi ký số" value={d.contracts.signatureIssues.failed} />
            <Metric label="Chờ xác nhận ký" value={d.contracts.signatureIssues.pendingConfirm} />
            <Metric
              label="Thoả thuận cọc chờ ký"
              value={d.contracts.depositAgreements.waitingSign}
            />
            {d.expiringContracts?.map((item) => (
              <ActionRow
                key={item.contractId}
                title={item.contractNumber || item.roomCode}
                detail={`Kết thúc ${date(item.endDateExclusive)}`}
                href={item.href}
                onAction={onAction}
              />
            ))}
            <ActionRow
              title="Tất cả hợp đồng cho thuê"
              href="/dashboard/landlord/contracts"
              onAction={onAction}
            />
          </>
        ) : null}
      </Section>
      <Section title="Phòng và tin đăng" unavailable={!d.rooms || !d.listings}>
        {d.rooms && d.listings ? (
          <>
            <Metric label="Đang ở / tổng phòng" value={`${d.rooms.occupied} / ${d.rooms.total}`} />
            <Metric label="Còn trống" value={d.rooms.vacant} />
            <Metric label="Đang giữ chỗ" value={d.rooms.reserved} />
            <Metric label="Tin đang hiển thị" value={d.listings.published} />
            <Metric label="Chờ duyệt" value={d.listings.pendingReview} />
            <Metric label="Bản nháp" value={d.listings.draft} />
            <Metric
              label="Tin cần điều chỉnh"
              value={
                d.listings.needsFix.rejected +
                d.listings.needsFix.violation +
                d.listings.needsFix.hidden
              }
            />
            <Metric label="Tin chưa gắn phòng" value={d.listings.unplaced.listings} />
            <Metric label="Hợp đồng chưa gắn phòng" value={d.listings.unplaced.contracts} />
            {d.listings.needsFix.items.map((item) => (
              <ActionRow
                key={item.id}
                title={item.title}
                detail={statusLabel(item.status)}
                href={item.href}
                onAction={onAction}
              />
            ))}
            {d.expiringListings?.map((item) => (
              <ActionRow
                key={item.id}
                title={item.title}
                detail={`Hết hạn ${date(item.expiresAt)}${item.noLeads ? ' · Chưa có khách quan tâm' : ''}`}
                href={item.href}
                onAction={onAction}
              />
            ))}
            <ActionRow title="Quản lý tin đăng" href="/dashboard/properties" onAction={onAction} />
          </>
        ) : null}
      </Section>
      <Section title="Gói hội viên" unavailable={!d.membership}>
        {d.membership ? (
          <>
            <Metric label="Gói hiện tại" value={d.membership.tier} />
            <Metric
              label="Lượt còn lại"
              value={d.membership.unlimited ? 'Không giới hạn' : d.membership.remainingUses}
            />
            <Metric label="Lượt đang giữ" value={d.membership.reservedUses} />
            <Metric label="Lượt mua thêm" value={d.membership.addonRemaining} />
            <Metric label="Hết hạn" value={date(d.membership.expiresAt)} />
            <Metric label="Đơn đang chờ" value={d.membership.pendingOrders} />
            <Metric label="Đơn lỗi trong 30 ngày" value={d.membership.failedOrders30d} />
            <Metric label="Chi phí hội viên trong kỳ" value={money(d.membership.paidVndMonth)} />
            <ActionRow title="Quản lý hội viên" href="/dashboard/membership" onAction={onAction} />
          </>
        ) : null}
      </Section>
      <Section title="Khách và lịch hẹn" unavailable={!d.appointments || !d.holds || !d.competing}>
        {d.appointments?.map((item) => (
          <ActionRow
            key={item.id}
            title={item.listingTitle}
            detail={`${date(item.at, true)} · ${statusLabel(item.status)}`}
            href={item.href}
            onAction={onAction}
          />
        ))}
        {d.holds?.map((item) => (
          <ActionRow
            key={item.rentalRequestId}
            title={item.listingTitle}
            detail={`Giữ chỗ đến ${date(item.holdExpiresAt, true)}`}
            href={item.href}
            onAction={onAction}
          />
        ))}
        {d.competing?.map((item) => (
          <ActionRow
            key={item.listingId}
            title={item.title}
            detail={`${item.pendingCount} yêu cầu đang chờ`}
            href={item.href}
            onAction={onAction}
          />
        ))}
        {!d.appointments?.length && !d.holds?.length && !d.competing?.length ? <Empty /> : null}
      </Section>
      <Complaints data={d.complaints} onAction={onAction} />
    </>
  );
}

export function TenantSummaryView({ onAction }: { onAction: Open }) {
  const state = useDashboardData(getTenantSummary);
  return (
    <View className="gap-4">
      <Refresh {...state} hasData={!!state.data} />
      {state.data ? <TenantContent data={state.data} onAction={onAction} /> : null}
    </View>
  );
}
function TenantContent({ data: d, onAction }: { data: TenantSummary; onAction: Open }) {
  return (
    <>
      <Text className="text-xs leading-5 text-muted-foreground">
        Hạn thuê theo ngày {date(d.billingNow)} · Lịch hẹn theo thời gian thực
      </Text>
      {!d.setup.onboarded ? (
        <Section title="Hoàn thiện thiết lập">
          <ActionRow
            title="Cập nhật thông tin tài khoản"
            href="/dashboard/settings"
            onAction={onAction}
          />
        </Section>
      ) : null}
      <Section title="Việc cần làm">
        <Metric label="Tổng số việc" value={d.tasks.total} />
        <Metric label="Cần ưu tiên" value={d.tasks.urgentCount} />
        {tasks(d.tasks.items, onAction)}
      </Section>
      <Section title="Khoản cần thanh toán">
        <Metric
          label={`Quá hạn · ${d.payables.overdueCount} khoản`}
          value={money(d.payables.overdueAmount)}
        />
        <Metric label="Sắp đến hạn" value={money(d.payables.dueSoonAmount)} />
        {d.payables.items.length ? (
          d.payables.items.map((item) => (
            <ActionRow
              key={item.paymentId}
              title={item.contractNumber || item.listingTitle || 'Khoản thanh toán'}
              detail={`${money(item.amount)} · Hạn ${date(item.dueAt, true)}${item.clock === 'BILLING' ? ' · theo kỳ thuê' : ''}${item.overdue ? ' · Quá hạn' : ''}`}
              href={item.href}
              onAction={onAction}
            />
          ))
        ) : (
          <Empty text="Chưa có khoản cần thanh toán." />
        )}
        <Metric
          label={`Chờ chủ nhà xác nhận · ${d.payables.awaiting.count} khoản`}
          value={money(d.payables.awaiting.amount)}
        />
        {d.payables.awaiting.items.map((item) => (
          <ActionRow
            key={item.paymentId}
            title={money(item.amount)}
            detail={`Hạn xác nhận ${date(item.confirmationDueAt, true)}`}
            href={item.href}
            onAction={onAction}
          />
        ))}
        <Metric
          label={`Sắp nhận hoàn · ${d.payables.refundsIncoming.count} khoản`}
          value={money(d.payables.refundsIncoming.amount)}
        />
        {d.payables.refundsIncoming.items.map((item) => (
          <ActionRow
            key={item.paymentId}
            title={`Khoản hoàn ${money(item.amount)}`}
            detail={`Hạn ${date(item.dueAt)}`}
            href={item.href}
            onAction={onAction}
          />
        ))}
      </Section>
      <Section title="Hợp đồng và nơi đang thuê">
        <Metric label="Hợp đồng đang hiệu lực" value={d.leases.activeCount} />
        {d.leases.items.length ? (
          d.leases.items.map((item) => (
            <ActionRow
              key={item.contractId}
              title={item.listingTitle || item.contractNumber}
              detail={`${money(item.monthlyRent)} / tháng · Kết thúc ${date(item.endExclusive)}`}
              href={item.href}
              onAction={onAction}
            />
          ))
        ) : (
          <Empty text="Chưa có hợp đồng đi thuê." />
        )}
      </Section>
      <Section title="Tiền cọc">
        <Metric label="Đang được giữ" value={money(d.deposits.heldTotal)} />
        {d.deposits.items.map((item) => (
          <ActionRow
            key={item.contractId}
            title={item.contractNumber}
            detail={`${money(item.amount)} · ${statusLabel(item.status)}${item.closure ? ` · Hoàn ${money(item.closure.refundAmount)}, hạn ${date(item.closure.refundDueAt)}` : ''}`}
            href={item.href}
            onAction={onAction}
          />
        ))}
        {!d.deposits.items.length ? <Empty text="Chưa có tiền cọc đang theo dõi." /> : null}
      </Section>
      <Section title="Giữ chỗ và yêu cầu thuê">
        {d.holds.map((item) => (
          <ActionRow
            key={item.rentalRequestId}
            title={item.listingTitle}
            detail={`${item.critical ? 'Sắp hết hạn · ' : ''}Giữ đến ${date(item.holdExpiresAt, true)} · Cần trả ${money(item.amountDue)}`}
            href={item.href}
            onAction={onAction}
          />
        ))}
        {d.requests.open.map((item) => (
          <ActionRow
            key={item.id}
            title={item.listingTitle}
            detail={`${statusLabel(item.status)} · Hạn ${date(item.respondBy)}`}
            href={item.href}
            onAction={onAction}
          />
        ))}
        {!d.holds.length && !d.requests.open.length ? <Empty /> : null}
      </Section>
      <Section title="Đang chờ chủ nhà">
        <Metric label="Hồ sơ đang chờ" value={d.waiting.count} />
        {d.waiting.items.map((item, index) => (
          <ActionRow
            key={`${item.contractId}-${index}`}
            title={item.contractNumber || 'Hồ sơ đang chờ'}
            detail={`Hạn ${date(item.respondBy)}`}
            href={item.href}
            onAction={onAction}
          />
        ))}
      </Section>
      <Section title="Lịch đi xem">
        <Metric label="Lịch sắp tới" value={d.visits.upcomingCount} />
        {d.visits.items.map((item) => (
          <ActionRow
            key={item.id}
            title={item.listingTitle}
            detail={`${date(item.appointmentDate)} · ${item.startTime.slice(0, 5)} · ${statusLabel(item.status)}`}
            href={`/dashboard/viewing-schedules/my-bookings?appointmentId=${encodeURIComponent(item.id)}`}
            onAction={onAction}
          />
        ))}
      </Section>
      <Section title="Chi tiêu">
        <Metric label="Đã trả theo phiếu thu" value={money(d.spending.total)} />
        <Metric label="Đã trả, chưa gồm cọc" value={money(d.spending.totalExcludingDeposit)} />
        <Metric label="12 tháng, chưa gồm cọc" value={money(d.spending.total12mExcludingDeposit)} />
        {d.spending.months.map((item) => (
          <Metric
            key={item.month}
            label={item.month.split('-').reverse().join('/')}
            value={money(item.total)}
          />
        ))}
        {d.spending.receiptPdfIssues ? (
          <Text className="text-sm text-warning">
            {d.spending.receiptPdfIssues} phiếu thu đang chờ xử lý PDF
          </Text>
        ) : null}
        <ActionRow
          title="Xem phiếu thu và thanh toán"
          href="/dashboard/payments"
          onAction={onAction}
        />
      </Section>
      <Complaints data={d.complaints} onAction={onAction} />
      <Section title="Tin đã lưu">
        <Metric label="Tổng số tin" value={d.saved.total} />
        <Metric label="Còn cho thuê" value={d.saved.available} />
        <Metric label="Không còn hiển thị" value={d.saved.unavailable} />
        <ActionRow title="Xem danh sách đã lưu" href="/favorites" onAction={onAction} />
      </Section>
    </>
  );
}
