// Web components/contract/detail/MonthlyInvoicesSection.tsx. The web <select>/side list of periods is a
// horizontal strip of cards.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { isAppVisible, useNotificationChangeSync } from '@/lib/rental-sync/hooks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { invoicePeriodLabel } from '@/lib/rental/invoice-status';
import {
  money,
  NOT_FOUND,
  previousEnd,
  seedDrafts,
  type Extra,
} from '@/lib/rental/MonthlyInvoicesSection';
import { withFileLease } from '@/services/rental/cache';
import { monthlyInvoiceService } from '@/services/rental/monthly-invoice.service';
import { paymentRequestService } from '@/services/rental/payment-request.service';
import storageService from '@/services/rental/storage.service';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

import ComplaintPanel from './ComplaintPanel';
import {
  LinkButton,
  Notice,
  SectionHeading,
  ToneBox,
  useActionLock,
  useAlive,
  useToast,
} from './common';
import InvoiceCard, { InvoiceStatusBadge } from './InvoiceCard';
import InvoiceDraftForm from './InvoiceDraftForm';
import InvoiceTransferBlock from './InvoiceTransferBlock';
import {
  assertSameReview,
  createSingleFlight,
  draftPayload,
  invoiceCardState,
  invoiceReportBlock,
  invoiceSelection,
  outstandingTotal,
  paymentOfInvoice,
  proofFor,
  sendTransferProof,
  type BoundProof,
} from './logic';

export type MonthlyInvoicesSectionProps = {
  contractId: string;
  rentalRequestId: string;
  contractActive: boolean;
  isLandlord: boolean;
  isTenant: boolean;
  electricityRequired: boolean;
  waterRequired: boolean;
  unsupportedWaterRate: boolean;
  initialElectricity?: string | number;
  initialWater?: string | number;
  requestedInvoiceId?: string | null;
  /** Raw ?invoice= rejected as malformed. Presence only: never sent to an API or used in a selector. */
  invalidInvoiceRequest?: string | null;
  onUpdated?: () => Promise<void>;
  /** Mobile only (web replaceState): keep `section=monthly&invoice=<id>` in the route, with `replace`. */
  onSelectInvoice?: (invoiceId: string) => void;
  /** Web reloads the page once a termination is completed or forced: re-open the contract. */
  onTerminated?: () => void;
};

/** Keyed by contract: drafts and data never move to another contract. */
export default function MonthlyInvoicesSection(props: MonthlyInvoicesSectionProps) {
  return <Section key={props.contractId} {...props} />;
}

type Drafts = Record<string, string>;
const emptyDirty = () => ({
  electricity: new Set<string>(),
  water: new Set<string>(),
  extras: new Set<string>(),
});

function Section({
  contractId,
  rentalRequestId,
  contractActive,
  isLandlord,
  isTenant,
  electricityRequired,
  waterRequired,
  unsupportedWaterRate,
  initialElectricity,
  initialWater,
  requestedInvoiceId,
  invalidInvoiceRequest,
  onUpdated,
  onSelectInvoice,
  onTerminated,
}: MonthlyInvoicesSectionProps) {
  const [invoices, setInvoices] = useState<MonthlyInvoice[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [electricity, setElectricity] = useState<Drafts>({});
  const [water, setWater] = useState<Drafts>({});
  const [extras, setExtras] = useState<Record<string, Extra[]>>({});
  const [proofs, setProofs] = useState<Record<string, BoundProof | undefined>>({});
  useDiscardDroppedFiles(Object.values(proofs).map((proof) => proof?.file));
  const [loadError, setLoadError] = useState('');
  const [refreshError, setRefreshError] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const requestKey = `${requestedInvoiceId ?? ''}\u0000${invalidInvoiceRequest ?? ''}`;
  const [seenRequest, setSeenRequest] = useState(requestKey);
  // A new external ?invoice= (valid or not) replaces an earlier local choice.
  if (seenRequest !== requestKey) {
    setSeenRequest(requestKey);
    setSelectedInvoiceId(null);
  }
  const { confirm, askReason } = useActionDialog();
  const toast = useToast();
  const isAlive = useAlive();
  const lock = useActionLock();
  const hasData = useRef(false);
  const dirtyDraft = useRef(emptyDirty());

  // A follow-up held back in the background is covered by the read on return: the app's foreground
  // recovery signal ('invoice-changed' without an id) matches the subscription below.
  const [refresh] = useState(() =>
    createSingleFlight(
      async () => {
        try {
          // Billing sync may raise a late fee and regenerate VietQR; fetch payments afterwards.
          const bills = await monthlyInvoiceService.list(contractId);
          if (!isAlive()) return;
          const paymentList = await paymentRequestService.getContractPayments(contractId);
          if (!isAlive()) return;
          hasData.current = true;
          const dirty = dirtyDraft.current;
          for (const ids of Object.values(dirty))
            for (const id of [...ids])
              if (!bills.some((bill) => bill.id === id && bill.status === 'DRAFT')) ids.delete(id);
          setLoadError('');
          setRefreshError(false);
          setInvoices(bills);
          setPayments(paymentList);
          setElectricity((previous) =>
            seedDrafts(previous, bills, dirty.electricity, (bill) =>
              bill.electricityEnd == null ? undefined : String(bill.electricityEnd)
            )
          );
          setWater((previous) =>
            seedDrafts(previous, bills, dirty.water, (bill) =>
              bill.waterEnd == null ? undefined : String(bill.waterEnd)
            )
          );
          setExtras((previous) =>
            seedDrafts(previous, bills, dirty.extras, (bill) =>
              (bill.draftExtraCharges || []).map((row) => ({
                description: row.description,
                amount: String(row.amount),
              }))
            )
          );
        } catch (error) {
          if (!isAlive()) return;
          // Keep the data already shown; only an empty page gets the blocking error.
          if (hasData.current) setRefreshError(true);
          else
            setLoadError(
              getApiErrorMessage(error, 'Không thể tải hóa đơn và trạng thái thanh toán.')
            );
        } finally {
          if (isAlive()) setLoading(false);
        }
      },
      isAlive,
      isAppVisible
    )
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useNotificationChangeSync(
    (event) =>
      (event.type === 'invoice-changed' &&
        (!event.contractId || event.contractId === contractId)) ||
      (event.type === 'agreement-changed' &&
        (!event.agreementId || event.agreementId === contractId)),
    refresh
  );

  const refreshAll = useCallback(async () => {
    await refresh();
    await onUpdated?.();
  }, [refresh, onUpdated]);

  /** One action at a time for the whole section (web actionMutex); `id` marks what is running. */
  const guard = (id: string, body: () => Promise<void>) =>
    void lock.run(async () => {
      setBusy(id);
      try {
        await body();
      } finally {
        if (isAlive()) setBusy(null);
      }
    });

  async function execute(id: string, action: () => Promise<unknown>, success: string) {
    try {
      await action();
      if (!isAlive()) return;
      for (const ids of Object.values(dirtyDraft.current)) ids.delete(id);
      toast.success(success);
      await refresh();
      await onUpdated?.();
    } catch (error) {
      if (!isAlive()) return;
      toast.error(getApiErrorMessage(error, 'Thao tác chưa thành công.'));
      await refresh();
    }
  }
  const perform = (id: string, action: () => Promise<unknown>, success: string) =>
    guard(id, () => execute(id, action, success));

  const openingReading = (invoice: MonthlyInvoice, kind: 'electricity' | 'water') =>
    previousEnd(invoices, invoice, kind, {
      electricity: initialElectricity,
      water: initialWater,
    });

  function payload(invoice: MonthlyInvoice) {
    const result = draftPayload({
      electricityText: electricity[invoice.id],
      waterText: water[invoice.id],
      electricityRequired,
      waterRequired,
      unsupportedWaterRate,
      previousElectricity: openingReading(invoice, 'electricity'),
      previousWater: openingReading(invoice, 'water'),
      extras: extras[invoice.id],
    });
    if (result.error !== undefined) {
      toast.error(result.error);
      return null;
    }
    return result.payload;
  }

  function prepare(invoice: MonthlyInvoice) {
    const data = payload(invoice);
    if (!data) return;
    perform(
      invoice.id,
      () => monthlyInvoiceService.prepare(invoice.id, data),
      'Đã lưu bản nháp. Người thuê chưa thấy hóa đơn; hãy chốt và phát hành khi chỉ số đã chính xác.'
    );
  }

  async function issue(invoice: MonthlyInvoice) {
    if (lock.held) return;
    const data = payload(invoice);
    if (!data) return;
    const ok = await confirm({
      title: 'Chốt chỉ số và phát hành hóa đơn?',
      description:
        'Người thuê sẽ thấy hóa đơn ngay. Hãy kiểm tra kỹ các khoản phí: hóa đơn đã phát hành hiện chưa thể sửa.',
      confirmLabel: 'Phát hành',
      tone: 'warning',
    });
    if (!ok || !isAlive()) return;
    perform(
      invoice.id,
      () => monthlyInvoiceService.issue(invoice.id, data),
      'Đã phát hành hóa đơn.'
    );
  }

  function report(payment: PaymentRequest) {
    const file = proofFor(proofs[payment.id], payment);
    // The lock already covers the amount check, so a double tap cannot report twice.
    // The file may be replaced during the amount check: the one being sent stays until it is done.
    guard(payment.id, () =>
      withFileLease(file ? [file.uri] : [], async () => {
        const block = await invoiceReportBlock(
          payment,
          file,
          paymentRequestService.getPaymentRequest
        );
        // Left the screen while checking: do not upload or report.
        if (!isAlive()) return;
        if (block) {
          toast.error(block.message);
          if (block.refresh) await refresh();
          return;
        }
        await execute(
          payment.id,
          async () => {
            const sent = await sendTransferProof(payment, {
              read: paymentRequestService.getPaymentRequest,
              upload: (paymentId) => storageService.uploadPaymentProof(file!, paymentId),
              report: (id, body) => paymentRequestService.reportTransfer(id, body),
              isAlive,
            });
            if (sent && isAlive())
              setProofs((previous) => ({ ...previous, [payment.id]: undefined }));
          },
          'Đã gửi chứng từ. Chờ chủ nhà xác nhận nhận tiền.'
        );
      })
    );
  }

  async function confirmReceipt(payment: PaymentRequest) {
    if (lock.held) return;
    const ok = await confirm({
      title: 'Xác nhận đã nhận tiền?',
      description: `Chỉ xác nhận khi tài khoản của bạn đã nhận đủ ${money(payment.totalAmount)} cho khoản chuyển này.`,
      confirmLabel: 'Đã nhận đủ',
      tone: 'warning',
    });
    if (!ok || !isAlive()) return;
    perform(
      payment.id,
      async () => {
        await assertSameReview(payment, paymentRequestService.getPaymentRequest);
        await paymentRequestService.confirmReceipt(payment.id);
      },
      'Đã xác nhận thanh toán.'
    );
  }

  async function rejectReceipt(payment: PaymentRequest) {
    if (lock.held) return;
    const reason = await askReason({
      title: 'Không chấp nhận chứng từ?',
      description: 'Người thuê sẽ thấy lý do này và có thể gửi lại chứng từ.',
      label: 'Lý do',
      minLength: 5,
      confirmLabel: 'Gửi lý do',
      tone: 'danger',
    });
    if (!reason || !isAlive()) return;
    perform(
      payment.id,
      async () => {
        await assertSameReview(payment, paymentRequestService.getPaymentRequest);
        await paymentRequestService.rejectReceipt(payment.id, { reason });
      },
      'Đã gửi lý do không chấp nhận chứng từ.'
    );
  }

  const outstanding = outstandingTotal(invoices);
  const { shown, ordered, requestMissing, selected } = invoiceSelection({
    invoices,
    payments,
    isLandlord,
    selectedInvoiceId,
    requestedInvoiceId,
    invalidInvoiceRequest,
  });
  const invoice = shown.find((item) => item.id === selected);

  function pickInvoice(id: string) {
    setSelectedInvoiceId(id);
    onSelectInvoice?.(id);
  }

  function renderCard(bill: MonthlyInvoice) {
    const payment = paymentOfInvoice(bill, payments);
    const state = invoiceCardState(bill, payment, { isLandlord, isTenant });
    return (
      <InvoiceCard
        key={bill.id}
        invoice={bill}
        payment={payment}
        state={state}
        contractActive={contractActive}
        isLandlord={isLandlord}
        isTenant={isTenant}
        refresh={refresh}
        refreshAll={refreshAll}
        onTerminated={onTerminated}
        draftForm={
          <InvoiceDraftForm
            invoice={bill}
            electricityRequired={electricityRequired}
            waterRequired={waterRequired}
            unsupportedWaterRate={unsupportedWaterRate}
            previousElectricity={openingReading(bill, 'electricity')}
            previousWater={openingReading(bill, 'water')}
            electricity={electricity[bill.id] ?? ''}
            water={water[bill.id] ?? ''}
            rows={extras[bill.id] || []}
            onElectricity={(value) => {
              dirtyDraft.current.electricity.add(bill.id);
              setElectricity((s) => ({ ...s, [bill.id]: value }));
            }}
            onWater={(value) => {
              dirtyDraft.current.water.add(bill.id);
              setWater((s) => ({ ...s, [bill.id]: value }));
            }}
            onRows={(rows) => {
              dirtyDraft.current.extras.add(bill.id);
              setExtras((s) => ({ ...s, [bill.id]: rows }));
            }}
            busy={busy !== null}
            onIssue={() => void issue(bill)}
            onSave={() => prepare(bill)}
          />
        }
        transfer={
          payment ? (
            <InvoiceTransferBlock
              payment={payment}
              state={state}
              isLandlord={isLandlord}
              busy={busy !== null}
              proof={proofs[payment.id]}
              onProof={(proof) => setProofs((s) => ({ ...s, [payment.id]: proof }))}
              onReport={() => report(payment)}
              onConfirm={() => void confirmReceipt(payment)}
              onReject={() => void rejectReceipt(payment)}
            />
          ) : null
        }
      />
    );
  }

  return (
    <View nativeID="monthly-invoices" className="gap-4">
      <View className="gap-1">
        <SectionHeading
          title="Hóa đơn thuê"
          icon="receipt-outline"
          refreshLabel="Làm mới hóa đơn"
          onRefresh={() => void refresh()}
        />
        <Text className="text-sm leading-6 text-muted-foreground">
          Chọn kỳ để xem chi tiết, chốt chỉ số hoặc xác nhận thanh toán.
        </Text>
      </View>
      {outstanding > 0 ? (
        <ToneBox tone="warning">
          <Text className="text-sm leading-6 text-warning">
            Tổng chưa xác nhận thanh toán: <Text className="font-bold">{money(outstanding)}</Text>.
            Khoản đã chuyển nợ chỉ tính trong hóa đơn mới.
          </Text>
        </ToneBox>
      ) : null}
      {refreshError && !loadError ? (
        <View
          accessibilityLiveRegion="polite"
          className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted px-3">
          <Text className="py-3 text-sm text-muted-foreground">
            Chưa cập nhật được dữ liệu mới nhất.
          </Text>
          <LinkButton label="Tải lại" onPress={() => void refresh()} />
        </View>
      ) : null}
      {loadError ? (
        <ErrorBlock message={loadError} onRetry={() => void refresh()} />
      ) : loading ? (
        <LoadingBlock label="Đang tải hóa đơn…" />
      ) : shown.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-border-strong bg-surface p-4">
          <PolicyNotice
            tone="neutral"
            title="Hóa đơn tháng"
            summary={
              isTenant
                ? 'Chưa có hóa đơn được phát hành.'
                : 'Chưa đến ngày cuối của kỳ thuê đầu tiên.'
            }>
            <Notice>
              {isTenant
                ? 'Chưa có hóa đơn được phát hành. Sau khi chủ nhà chốt chỉ số và phát hành, bạn sẽ thấy số tiền và QR thanh toán tại đây.'
                : 'Chưa đến ngày cuối của kỳ thuê đầu tiên. Hóa đơn nháp sẽ xuất hiện để chủ nhà chốt chỉ số.'}
            </Notice>
          </PolicyNotice>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityLabel="Chọn kỳ hóa đơn"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-2">
            {ordered.map((bill) => (
              <Pressable
                key={bill.id}
                disabled={busy !== null}
                onPress={() => pickInvoice(bill.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === bill.id, disabled: busy !== null }}
                className={`w-56 gap-1.5 rounded-2xl border p-3 active:opacity-80 ${selected === bill.id ? 'border-primary bg-primary-soft' : 'border-border bg-surface'} ${busy !== null ? 'opacity-50' : ''}`}>
                <Text numberOfLines={2} className="text-sm font-semibold text-foreground">
                  {invoicePeriodLabel(bill)}
                </Text>
                <Text className="text-sm font-bold text-foreground">{money(bill.totalAmount)}</Text>
                <InvoiceStatusBadge
                  invoice={bill}
                  paymentStatus={paymentOfInvoice(bill, payments)?.status}
                />
              </Pressable>
            ))}
          </ScrollView>
          {requestMissing ? (
            // Web role="status": a neutral notice, announced politely.
            <View accessibilityLiveRegion="polite">
              <ToneBox tone="warning">{NOT_FOUND}</ToneBox>
            </View>
          ) : invoice ? (
            renderCard(invoice)
          ) : null}
        </>
      )}
      {rentalRequestId ? (
        <ComplaintPanel rentalRequestId={rentalRequestId} onUpdated={refresh} />
      ) : null}
    </View>
  );
}
