// Web components/contract/detail/ContractLifecyclePanel.tsx, mode="settlement" only (renewal belongs to the
// contract screens).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';

import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { useNotificationChangeSync } from '@/lib/rental-sync/hooks';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { closureLabels, dt, money } from '@/lib/rental/ContractLifecyclePanel';
import { invoicePeriodLabel } from '@/lib/rental/invoice-status';
import { paymentModulePath } from '@/lib/rental/payment-module';
import { contractLifecycleService } from '@/services/rental/contract-lifecycle.service';
import type { ContractLifecycle } from '@/types/rental/contract-lifecycle.type';

import ClosureProposalForm from './ClosureProposalForm';
import ClosureProposalView, { ClosureHistory } from './ClosureProposalView';
import {
  LinkButton,
  Notice,
  SectionHeading,
  StorageLinks,
  ToneBox,
  useActionLock,
  useAlive,
  useToast,
} from './common';
import DepositLedgerSummary from './DepositLedgerSummary';
import FinalCostsForm from './FinalCostsForm';
import {
  billStatusText,
  billsSummaryText,
  createRetryId,
  createSingleFlight,
  lastBilledOf,
  noDepositToRefund,
  transferOverdue,
} from './logic';
import SettlementPaymentPanel from './SettlementPaymentPanel';

type Props = {
  contractId: string;
  isLandlord: boolean;
  /** Must refresh without unmounting this panel: it runs after every successful read. */
  onUpdated?: () => Promise<void>;
  /** False when the deposit ledger is already on the screen (RentalOnboardingPanel). */
  showLedger?: boolean;
  /** Mobile only: web links to the invoices and to the complaint. */
  onNavigate: RentalNavigate;
};

/** Keyed by contract: drafts never move to another contract. */
export default function ContractLifecyclePanel(props: Props) {
  return <Lifecycle key={props.contractId} {...props} />;
}

function Lifecycle({ contractId, isLandlord, onUpdated, showLedger = true, onNavigate }: Props) {
  const [data, setData] = useState<ContractLifecycle | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useActionLock();
  const isAlive = useAlive();
  const toast = useToast();
  const parent = useRef(onUpdated);
  useEffect(() => {
    parent.current = onUpdated;
  });
  const version = useRef<number | null>(null);
  const [handover, setHandover] = useState(false);
  // Consent belongs to the proposal the tenant actually read, not the next refreshed revision.
  const [consent, setConsent] = useState<string | null>(null);
  const [supplementRetry] = useState(() => createRetryId(randomUUID));

  const [refresh] = useState(() =>
    createSingleFlight(async () => {
      try {
        const next = await contractLifecycleService.get(contractId);
        if (!isAlive()) return;
        const nextVersion = next.closure?.proposalVersion ?? 0;
        if (version.current !== null && version.current !== nextVersion) {
          setHandover(false);
          setConsent(null);
        }
        version.current = nextVersion;
        setData(next);
        setError('');
        await parent.current?.();
      } catch (cause) {
        if (isAlive()) setError(getApiErrorMessage(cause, 'Chưa tải được vòng đời hợp đồng.'));
      }
    }, isAlive)
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useNotificationChangeSync(
    (event) =>
      event.type === 'payment-changed' ||
      (event.type === 'invoice-changed' &&
        (!event.contractId || event.contractId === contractId)) ||
      (event.type === 'agreement-changed' &&
        (!event.agreementId ||
          event.agreementId === contractId ||
          !!data?.renewals.some((r) => r.agreementContractId === event.agreementId))),
    refresh
  );

  const perform = useCallback(
    (action: () => Promise<unknown>) =>
      void lock.run(async () => {
        setBusy(true);
        try {
          await action();
          if (!isAlive()) return;
          await refresh();
          if (isAlive()) {
            setConsent(null);
            toast.success('Đã cập nhật hồ sơ hợp đồng.');
          }
        } catch (cause) {
          if (isAlive()) toast.error(getApiErrorMessage(cause, 'Thao tác chưa thành công.'));
        } finally {
          if (isAlive()) setBusy(false);
        }
      }),
    [lock, isAlive, refresh, toast]
  );

  const closure = data?.closure;
  return (
    <View className="gap-4 rounded-2xl border border-border bg-surface p-4">
      <SectionHeading
        title="Quyết toán & hoàn cọc"
        icon="clipboard-outline"
        refreshLabel="Làm mới vòng đời hợp đồng"
        onRefresh={() => void refresh()}
      />
      {error ? (
        <Text accessibilityRole="alert" className="text-sm leading-6 text-danger">
          {error}
        </Text>
      ) : null}
      {!data && !error ? <LoadingBlock label="Đang tải…" /> : null}
      {data ? (
        <>
          {showLedger ? <DepositLedgerSummary ledger={data.deposit} /> : null}
          {!closure ? <NoClosure data={data} /> : null}
          {closure ? (
            <ClosureBody
              data={data}
              contractId={contractId}
              isLandlord={isLandlord}
              onNavigate={onNavigate}
              finalCosts={
                data.billing.canIssueSupplement ? (
                  <FinalCostsForm
                    contractId={contractId}
                    noDeposit={noDepositToRefund(data)}
                    lastBilled={lastBilledOf(data.billing.bills)}
                    retry={supplementRetry}
                    busy={busy}
                    perform={perform}
                  />
                ) : null
              }
              proposalForm={
                data.canProposeClosure ? (
                  <ClosureProposalForm
                    contractId={contractId}
                    data={data}
                    noDeposit={noDepositToRefund(data)}
                    handover={handover}
                    onHandover={setHandover}
                    busy={busy}
                    perform={perform}
                  />
                ) : null
              }
              proposalView={
                <ClosureProposalView
                  contractId={contractId}
                  data={data}
                  isLandlord={isLandlord}
                  noDeposit={noDepositToRefund(data)}
                  consent={consent}
                  onConsent={setConsent}
                  busy={busy}
                  perform={perform}
                />
              }
              payments={[data.refundPayment, data.balancePayment].map((payment) =>
                payment ? (
                  <SettlementPaymentPanel
                    key={payment.id}
                    payment={payment}
                    isLandlord={isLandlord}
                    refresh={refresh}
                  />
                ) : null
              )}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function NoClosure({ data }: { data: ContractLifecycle }) {
  return (
    <View className="gap-3 rounded-xl bg-muted p-4">
      <Text className="text-sm text-foreground">
        Cọc đang giữ: <Text className="font-bold">{money(data.heldDeposit)}</Text>
      </Text>
      <PolicyNotice
        tone="neutral"
        title="Hoàn cọc & quyết toán"
        text={
          noDepositToRefund(data)
            ? 'Không có tiền cọc cần hoàn. Khi kết thúc thuê, hai bên vẫn cần xác nhận trả nhà, hoàn tất hóa đơn và các khoản còn phải trả.'
            : 'Hồ sơ hoàn cọc mở khi kết thúc thời hạn thuê. Hai bên hoàn tất chi phí cuối, bàn giao và thống nhất khoản khấu trừ trước khi chuyển tiền hoàn.'
        }
      />
    </View>
  );
}

/** CLP:206-314: bill step, handover step, proposal, history, settlement payments. */
function ClosureBody({
  data,
  contractId,
  isLandlord,
  onNavigate,
  finalCosts,
  proposalForm,
  proposalView,
  payments,
}: {
  data: ContractLifecycle;
  contractId: string;
  isLandlord: boolean;
  onNavigate: RentalNavigate;
  finalCosts: React.ReactNode;
  proposalForm: React.ReactNode;
  proposalView: React.ReactNode;
  payments: React.ReactNode;
}) {
  const closure = data.closure!;
  const noDeposit = noDepositToRefund(data);
  const closed = closure.status === 'CLOSED';
  const disputed = data.closure!.history?.filter((event) => event.type === 'DISPUTED').at(-1);
  return (
    <View className="gap-4">
      <Accordion
        key={String(data.billing.allPaid)}
        title={`Bước 1 · Hoàn tất hóa đơn kỳ cuối${data.billing.allPaid ? ' · Đã hoàn tất ✓ — xem chi tiết' : ' · Cần xử lý'}`}
        defaultOpen={!data.billing.allPaid}>
        <View className="gap-3">
          <PolicyNotice
            tone="neutral"
            title="Hóa đơn kỳ cuối"
            summary="Điện, nước, dịch vụ thanh toán trong mục Hóa đơn theo kỳ, không trừ vào cọc.">
            <Notice>
              Điện, nước, dịch vụ và chi phí phát sinh được thanh toán trong mục Hóa đơn. Không gia
              hạn thuê thì bill cuối không thu tiền phòng kỳ tiếp theo; điện/nước không trừ vào cọc.
            </Notice>
          </PolicyNotice>
          {data.billing.bills.map((bill) => (
            <View key={bill.id} className="gap-1 border-b border-border pb-2">
              <Text className="text-sm text-foreground">{invoicePeriodLabel(bill)}</Text>
              <Text className="text-sm font-bold text-foreground">
                {money(bill.totalAmount)} · {billStatusText(bill)}
              </Text>
            </View>
          ))}
          <Text
            className={`text-sm font-bold leading-6 ${data.billing.allPaid ? 'text-success' : 'text-warning'}`}>
            {billsSummaryText(data)}
          </Text>
          <ActionButton
            label={
              isLandlord
                ? 'Mở hóa đơn · Chốt chỉ số / xác nhận nhận tiền →'
                : 'Mở hóa đơn · Thanh toán kỳ cuối →'
            }
            onClick={() => onNavigate(paymentModulePath(contractId, 'monthly'))}
          />
          {finalCosts}
        </View>
      </Accordion>
      <Text accessibilityRole="header" className="text-base font-bold leading-6 text-foreground">
        {noDeposit ? 'Trả nhà & quyết toán' : 'Bàn giao & tiền cọc'} ·{' '}
        {noDeposit && closed ? 'Đã hoàn tất quyết toán' : closureLabels[closure.status]}
      </Text>
      {!closed ? (
        <PolicyNotice
          tone="neutral"
          title="Bàn giao & tiền cọc"
          summary={
            noDeposit ? (
              'Không có tiền cọc cần hoàn.'
            ) : (
              <>
                Cọc đang giữ: <Text className="font-bold">{money(data.heldDeposit)}</Text>.
              </>
            )
          }>
          <Notice>
            {noDeposit ? (
              'Không có tiền cọc cần hoàn. Hai bên vẫn xác nhận trả nhà, hoàn tất hóa đơn và thống nhất khoản còn phải trả nếu có.'
            ) : (
              <>
                Cọc đang giữ: <Text className="font-bold">{money(data.heldDeposit)}</Text>. Hoàn tất
                hóa đơn rồi thống nhất khấu trừ và số tiền hoàn.
              </>
            )}
          </Notice>
        </PolicyNotice>
      ) : (
        <ToneBox tone="success">
          <Text className="text-sm font-bold leading-6 text-success">
            Đã kết thúc hợp đồng ·{' '}
            {noDeposit ? 'Hoàn tất quyết toán cọc' : 'Hoàn tất xử lý tiền cọc'}
          </Text>
          <Text className="text-sm leading-6 text-success">
            {data.refundPayment
              ? `Đã hoàn ${money(data.refundPayment.totalAmount)} cho người thuê và xác nhận nhận tiền.`
              : data.balancePayment
                ? 'Đã xác nhận thanh toán khoản quyết toán còn thiếu.'
                : noDeposit
                  ? 'Hai bên đã xác nhận trả nhà và hoàn tất quyết toán cọc; không phát sinh chuyển khoản hoàn cọc.'
                  : 'Hai bên đã thống nhất khấu trừ và hoàn tất quyết toán cọc.'}
          </Text>
        </ToneBox>
      )}
      {closure.respondBy ? (
        <ToneBox tone={closure.responseOverdueAt ? 'warning' : 'neutral'}>
          {`${closure.status === 'DISPUTED' ? 'Chủ nhà cần phản hồi đối soát' : 'Người thuê cần phản hồi đề xuất'} trước ${dt(closure.respondBy)}.${
            closure.responseOverdueAt
              ? ' Đã quá hạn phản hồi. Hai bên cần liên hệ xử lý; không tự đồng ý, không tự tạo QR hoặc đóng hồ sơ.'
              : ''
          }`}
        </ToneBox>
      ) : null}
      {transferOverdue(data) ? (
        <ToneBox tone="warning">
          Đã quá hạn chuyển tiền quyết toán. Cần liên hệ bên thanh toán để đối soát; hồ sơ vẫn mở
          cho đến khi xác nhận đã nhận đủ tiền.
        </ToneBox>
      ) : null}
      {closure.status === 'DISPUTED' ? (
        <ToneBox tone="warning">
          <Text className="text-sm font-bold leading-6 text-warning">
            Người thuê chưa đồng ý ·{' '}
            {noDeposit ? 'chưa chốt khoản phải trả' : 'chưa tạo QR hoàn cọc'}
          </Text>
          {disputed?.note ? (
            <Text className="text-sm leading-6 text-warning">{disputed.note}</Text>
          ) : null}
          <StorageLinks
            ids={disputed?.evidenceIds}
            label="Xem minh chứng"
            suffix=" ↗"
            fallback="Không mở được minh chứng."
          />
          <PolicyNotice
            tone="warning"
            title="Khiếu nại đề xuất quyết toán"
            summary="Chủ nhà đối chiếu minh chứng và gửi đề xuất phiên bản mới.">
            <Notice>
              Chủ nhà đối chiếu minh chứng và gửi đề xuất phiên bản mới. Người thuê cần đọc và đồng
              ý lại.
            </Notice>
          </PolicyNotice>
        </ToneBox>
      ) : null}
      {data.earlyReturnPending ? (
        <View
          accessibilityLiveRegion="polite"
          className="gap-2 rounded-2xl border border-warning bg-warning-soft p-3">
          <Text className="text-sm font-bold text-warning">
            Xác nhận bàn giao cùng đề xuất quyết toán
          </Text>
          <PolicyNotice
            tone="warning"
            title="Xác nhận bàn giao cùng đề xuất quyết toán"
            summary="Gửi/đồng ý đề xuất đồng thời là xác nhận đã bàn giao nhà.">
            <Notice>
              Chủ nhà xác nhận đã nhận lại nhà khi gửi đề xuất bên dưới. Người thuê xác nhận đã trả
              nhà khi đồng ý đúng phiên bản đề xuất; sau đó hệ thống mới tạo khoản hoàn hoặc khoản
              phải trả thêm. Không cần xác nhận lại ở hồ sơ chấm dứt sớm.
            </Notice>
          </PolicyNotice>
        </View>
      ) : null}
      {proposalForm}
      {proposalView}
      {closure.complaintCaseId && !closure.complaintOwnerApprovedAt ? (
        <View>
          <Text className="text-sm leading-6 text-warning">
            Đề xuất từ hồ sơ khiếu nại cần chủ nhà đồng ý trước.{' '}
            {data.rentalRequestId
              ? ''
              : 'Mở hồ sơ khiếu nại từ thông báo hoặc mục Hóa đơn thuê của hợp đồng thuê.'}
          </Text>
          {data.rentalRequestId ? (
            <LinkButton
              label="Mở hồ sơ khiếu nại"
              onPress={() =>
                onNavigate({
                  screen: 'complaint',
                  requestId: data.rentalRequestId!,
                  complaintId: closure.complaintCaseId!,
                })
              }
            />
          ) : null}
        </View>
      ) : null}
      <ClosureHistory data={data} />
      {payments}
    </View>
  );
}
