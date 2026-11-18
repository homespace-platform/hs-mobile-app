import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorNotice, ScreenHeader } from '@/components/Screen';
import DatePeriodFilter from '@/components/DatePeriodFilter';
import { apiError } from '@/lib/api-error';
import { getDatePeriodRange, toLocalDateKey, type DatePeriod } from '@/lib/date-period';
import { money, paymentTypeLabel, statusLabel, type Payment } from '@/services/managementApi';
import {
  getBillingContracts,
  getContractPayments,
  getMonthlyInvoices,
  getPayment,
  getPaymentReceipts,
  retryReceiptPdf,
  shareReceiptPdf,
  type BillingContract,
  type MonthlyInvoice,
  type PaymentReceipt,
} from '@/services/billingApi';

function date(value?: string) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '—';
}

function FilterChips({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: { value: string | null; label: string }[];
  selected: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-semibold text-muted-foreground">{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((option) => (
          <Pressable
            key={option.value ?? 'ALL'}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === option.value }}
            className={`mr-2 min-h-10 justify-center rounded-full border px-4 ${selected === option.value ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
            <Text
              className={`text-sm font-semibold ${selected === option.value ? 'text-primary' : 'text-secondary'}`}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function BillingScreen({
  owner,
  userId,
  onBack,
  onOpenPayment,
}: {
  owner: boolean;
  userId: string;
  onBack: () => void;
  onOpenPayment: (payment: Payment) => void;
}) {
  const [contracts, setContracts] = useState<BillingContract[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<BillingContract | null>(null);
  const [invoices, setInvoices] = useState<MonthlyInvoice[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [receiptPage, setReceiptPage] = useState(1);
  const [moreReceipts, setMoreReceipts] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [contractStatus, setContractStatus] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'invoices' | 'payments' | 'receipts'>('invoices');
  const [itemStatus, setItemStatus] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<string | null>(null);
  const [direction, setDirection] = useState<string | null>(null);
  const [period, setPeriod] = useState<DatePeriod>('ALL');
  const [anchor, setAnchor] = useState(() => new Date());
  const detailRequest = useRef(0);
  const contractRequest = useRef(0);

  const search = query.trim().toLocaleLowerCase('vi');
  const range = getDatePeriodRange(anchor, period);
  const inDate = (value?: string | null) => {
    if (!range) return true;
    const day = toLocalDateKey(value);
    return Boolean(day && day >= range.start && day <= range.end);
  };
  const visibleContracts = contracts.filter(
    (contract) =>
      contract.contractNumber.toLocaleLowerCase('vi').includes(search) && inDate(contract.createdAt)
  );
  const visibleInvoices = invoices.filter(
    (invoice) =>
      (!itemStatus || invoice.status === itemStatus) &&
      inDate(invoice.periodStart) &&
      [
        invoice.periodIndex,
        invoice.status,
        money(invoice.totalAmount),
        ...(invoice.lines ?? []).map((line) => line.description),
      ]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(search)
  );
  const visiblePayments = payments.filter(
    (payment) =>
      (!itemStatus || payment.status === itemStatus) &&
      (!paymentType || payment.type === paymentType) &&
      (!direction || (payment.payerId === userId ? 'pay' : 'receive') === direction) &&
      inDate(payment.createdAt) &&
      [
        payment.transferReference,
        paymentTypeLabel(payment.type),
        payment.status,
        money(payment.totalAmount),
      ]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(search)
  );
  const visibleReceipts = receipts.filter(
    (receipt) =>
      (!itemStatus || receipt.pdfStatus === itemStatus) &&
      inDate(receipt.issuedAt) &&
      [
        receipt.receiptNumber,
        receipt.title,
        receipt.payerName,
        receipt.payeeName,
        money(receipt.totalAmount),
      ]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(search)
  );
  const activeStatuses = Array.from(
    new Set(
      detailTab === 'invoices'
        ? invoices.map((item) => item.status)
        : detailTab === 'payments'
          ? payments.map((item) => item.status)
          : receipts.map((item) => item.pdfStatus)
    )
  );

  const loadContracts = useCallback(
    async (nextPage = 1) => {
      const request = ++contractRequest.current;
      setLoading(true);
      setError(null);
      try {
        const result = await getBillingContracts(owner, nextPage, contractStatus ?? undefined);
        if (request !== contractRequest.current) return;
        setContracts((current) =>
          nextPage === 1 ? result.result : [...current, ...result.result]
        );
        setHasMore(result.hasMore);
        setPage(nextPage);
      } catch (cause) {
        if (request === contractRequest.current) setError(apiError(cause));
      } finally {
        if (request === contractRequest.current) setLoading(false);
      }
    },
    [owner, contractStatus]
  );

  const openContract = useCallback(
    async (contract: BillingContract) => {
      const request = ++detailRequest.current;
      setSelected(contract);
      setInvoices([]);
      setReceipts([]);
      setReceiptPage(1);
      setMoreReceipts(false);
      setPayments([]);
      setDetailLoading(true);
      setError(null);
      try {
        const [invoiceRows, receiptRows, paymentRows] = await Promise.allSettled([
          getMonthlyInvoices(contract.id),
          getPaymentReceipts(owner, contract.id),
          getContractPayments(contract.id),
        ]);
        if (request !== detailRequest.current) return;
        if (invoiceRows.status === 'fulfilled') setInvoices(invoiceRows.value);
        if (receiptRows.status === 'fulfilled') {
          setReceipts(receiptRows.value.result ?? []);
          setMoreReceipts(receiptRows.value.hasMore);
        }
        if (paymentRows.status === 'fulfilled') setPayments(paymentRows.value);
        if ([invoiceRows, receiptRows, paymentRows].some((result) => result.status === 'rejected'))
          setError('Một phần hồ sơ chưa tải được. Kéo xuống để thử lại.');
      } catch (cause) {
        if (request === detailRequest.current) setError(apiError(cause));
      } finally {
        if (request === detailRequest.current) setDetailLoading(false);
      }
    },
    [owner]
  );

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  async function openPayment(id: string) {
    setError(null);
    try {
      onOpenPayment(await getPayment(id));
    } catch (cause) {
      setError(apiError(cause));
    }
  }

  async function loadMoreReceipts() {
    if (!selected || !moreReceipts || detailLoading) return;
    const request = detailRequest.current;
    setDetailLoading(true);
    setError(null);
    try {
      const nextPage = receiptPage + 1;
      const result = await getPaymentReceipts(owner, selected.id, nextPage);
      if (request !== detailRequest.current) return;
      setReceipts((current) => [...current, ...(result.result ?? [])]);
      setReceiptPage(nextPage);
      setMoreReceipts(result.hasMore);
    } catch (cause) {
      if (request === detailRequest.current) setError(apiError(cause));
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }

  async function receiptAction(receipt: PaymentReceipt) {
    setError(null);
    try {
      if (receipt.pdfStatus === 'FAILED') {
        await retryReceiptPdf(receipt.id);
        if (selected) await openContract(selected);
      } else {
        await shareReceiptPdf(receipt.id);
      }
    } catch (cause) {
      setError(apiError(cause));
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader
        title={selected ? selected.contractNumber : 'Hóa đơn & chứng từ'}
        onBack={
          selected
            ? () => {
                detailRequest.current++;
                setSelected(null);
              }
            : onBack
        }
      />
      <ScrollView
        contentContainerClassName="px-5 pb-10 pt-5"
        refreshControl={
          <RefreshControl
            refreshing={selected ? detailLoading : loading}
            onRefresh={() => void (selected ? openContract(selected) : loadContracts())}
          />
        }>
        <ErrorNotice message={error} />
        {selected ? (
          <View className="mb-4 flex-row gap-2">
            {(
              [
                ['invoices', 'Hóa đơn'],
                ['payments', 'Thanh toán'],
                ['receipts', 'Chứng từ'],
              ] as const
            ).map(([tab, label]) => (
              <Pressable
                key={tab}
                onPress={() => {
                  setDetailTab(tab);
                  setItemStatus(null);
                  setPaymentType(null);
                  setDirection(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: detailTab === tab }}
                className={`min-h-11 flex-1 items-center justify-center rounded-xl border ${detailTab === tab ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                <Text
                  className={`text-xs font-bold ${detailTab === tab ? 'text-primary' : 'text-secondary'}`}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={
            selected
              ? detailTab === 'invoices'
                ? 'Tìm kỳ, phí hoặc số tiền'
                : detailTab === 'payments'
                  ? 'Tìm mã chuyển khoản, loại khoản tiền'
                  : 'Tìm số phiếu, người trả hoặc nhận'
              : 'Tìm mã hợp đồng trong danh sách đã tải'
          }
          accessibilityLabel="Tìm trong hồ sơ thanh toán"
          className="mb-4 min-h-12 rounded-xl border border-border bg-surface px-4 text-sm text-foreground placeholder:text-subtle"
        />
        <DatePeriodFilter
          period={period}
          anchor={anchor}
          onPeriodChange={setPeriod}
          onAnchorChange={setAnchor}
        />
        <Text className="mb-3 text-xs text-muted-foreground">
          {selected
            ? detailTab === 'invoices'
              ? 'Thời gian: ngày bắt đầu kỳ hóa đơn'
              : detailTab === 'payments'
                ? 'Thời gian: ngày tạo khoản thanh toán'
                : 'Thời gian: ngày phát hành chứng từ'
            : 'Thời gian: ngày tạo hợp đồng'}
        </Text>
        {selected ? (
          <>
            {activeStatuses.length > 1 ? (
              <FilterChips
                title={detailTab === 'receipts' ? 'Trạng thái PDF' : 'Trạng thái'}
                options={[
                  { value: null, label: 'Tất cả' },
                  ...activeStatuses.map((status) => ({
                    value: status,
                    label:
                      detailTab === 'receipts' && status === 'PENDING'
                        ? 'Đang tạo'
                        : statusLabel(status),
                  })),
                ]}
                selected={itemStatus}
                onChange={setItemStatus}
              />
            ) : null}
            {detailTab === 'payments' ? (
              <>
                <FilterChips
                  title="Loại khoản tiền"
                  options={[
                    { value: null, label: 'Tất cả' },
                    ...Array.from(new Set(payments.map((payment) => payment.type))).map((type) => ({
                      value: type,
                      label: paymentTypeLabel(type),
                    })),
                  ]}
                  selected={paymentType}
                  onChange={setPaymentType}
                />
                <FilterChips
                  title="Chiều chuyển tiền"
                  options={[
                    { value: null, label: 'Cả hai' },
                    { value: 'pay', label: 'Tôi chuyển' },
                    { value: 'receive', label: 'Tôi nhận' },
                  ]}
                  selected={direction}
                  onChange={setDirection}
                />
              </>
            ) : null}
          </>
        ) : (
          <FilterChips
            title="Trạng thái hợp đồng"
            options={[
              { value: null, label: 'Tất cả' },
              ...[
                'DRAFT',
                'LANDLORD_SIGNATURE_PENDING',
                'TENANT_SIGNATURE_PENDING',
                'ACTIVE',
                'EXPIRED',
                'CLOSED',
                'TERMINATED',
                'CANCELLED',
              ].map((status) => ({ value: status, label: statusLabel(status) })),
            ]}
            selected={contractStatus}
            onChange={setContractStatus}
          />
        )}
        {query || period !== 'ALL' || itemStatus || paymentType || direction || contractStatus ? (
          <Pressable
            onPress={() => {
              setQuery('');
              setPeriod('ALL');
              setItemStatus(null);
              setPaymentType(null);
              setDirection(null);
              setContractStatus(null);
            }}
            accessibilityRole="button"
            className="mb-4 self-start">
            <Text className="text-sm font-semibold text-primary">Xóa bộ lọc</Text>
          </Pressable>
        ) : null}
        {selected ? (
          <>
            {detailTab === 'invoices' ? (
              <>
                <Text className="mb-2 text-xs text-muted-foreground">
                  {visibleInvoices.length} hóa đơn phù hợp
                </Text>
                <Text className="text-lg font-bold text-foreground">Hóa đơn theo kỳ</Text>
                {detailLoading ? (
                  <ActivityIndicator className="my-5 text-primary" />
                ) : visibleInvoices.length ? (
                  visibleInvoices.map((invoice) => (
                    <View
                      key={invoice.id}
                      className="mt-3 rounded-2xl border border-border bg-surface p-4">
                      <Text className="font-bold text-foreground">
                        Kỳ {invoice.periodIndex} · {date(invoice.periodStart)} đến trước{' '}
                        {date(invoice.periodEndExclusive)}
                      </Text>
                      <Text className="mt-1 text-sm text-primary">
                        {statusLabel(invoice.status)} · {money(invoice.totalAmount)}
                      </Text>
                      <Text className="mt-1 text-xs text-secondary">
                        Hạn thanh toán: {date(invoice.dueAt)}
                        {invoice.paidAt ? ` · Đã trả: ${date(invoice.paidAt)}` : ''}
                      </Text>
                      {invoice.electricityStart != null && invoice.electricityEnd != null ? (
                        <Text className="mt-1 text-xs text-secondary">
                          Điện: {invoice.electricityStart} → {invoice.electricityEnd}
                        </Text>
                      ) : null}
                      {invoice.waterStart != null && invoice.waterEnd != null ? (
                        <Text className="mt-1 text-xs text-secondary">
                          Nước: {invoice.waterStart} → {invoice.waterEnd}
                        </Text>
                      ) : null}
                      {invoice.lateFeeAmount ? (
                        <Text className="mt-1 text-xs text-warning">
                          Phí chậm thanh toán: {money(invoice.lateFeeAmount)}
                        </Text>
                      ) : null}
                      {invoice.lines?.map((line, index) => (
                        <View
                          key={`${invoice.id}-${index}`}
                          className="mt-2 flex-row justify-between gap-3 border-t border-border pt-2">
                          <Text className="flex-1 text-xs text-secondary">
                            {line.description} · {line.quantity} × {money(line.unitPrice)}
                          </Text>
                          <Text className="text-xs font-semibold text-foreground">
                            {money(line.amount)}
                          </Text>
                        </View>
                      ))}
                      {invoice.paymentRequestId ? (
                        <Button
                          label="Xem yêu cầu thanh toán"
                          onPress={() => void openPayment(invoice.paymentRequestId!)}
                        />
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Text className="mt-3 text-sm text-muted-foreground">
                    Không có hóa đơn phù hợp bộ lọc.
                  </Text>
                )}
              </>
            ) : null}
            {detailTab === 'payments' ? (
              <>
                <Text className="mb-2 text-xs text-muted-foreground">
                  {visiblePayments.length} khoản phù hợp
                </Text>
                <Text className="mt-7 text-lg font-bold text-foreground">
                  Các khoản thu, cọc và hoàn tiền
                </Text>
                {!detailLoading &&
                  (visiblePayments.length ? (
                    visiblePayments.map((payment) => (
                      <Pressable
                        key={payment.id}
                        onPress={() => void openPayment(payment.id)}
                        accessibilityRole="button"
                        className="mt-3 rounded-2xl border border-border bg-surface p-4">
                        <Text className="font-bold text-foreground">
                          {paymentTypeLabel(payment.type)} · {money(payment.totalAmount)}
                        </Text>
                        <Text className="mt-1 text-sm text-primary">
                          {statusLabel(payment.status)} · Xem QR, chứng từ và thao tác →
                        </Text>
                        <Text className="mt-1 text-xs text-muted-foreground">
                          {payment.transferReference}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text className="mt-3 text-sm text-muted-foreground">
                      Không có khoản thanh toán phù hợp bộ lọc.
                    </Text>
                  ))}
              </>
            ) : null}
            {detailTab === 'receipts' ? (
              <>
                <Text className="mb-2 text-xs text-muted-foreground">
                  {visibleReceipts.length} chứng từ phù hợp
                  {moreReceipts ? ' trong các trang đã tải' : ''}
                </Text>
                <Text className="mt-7 text-lg font-bold text-foreground">
                  Chứng từ đã thanh toán
                </Text>
                {!detailLoading &&
                  (visibleReceipts.length ? (
                    visibleReceipts.map((receipt) => (
                      <View
                        key={receipt.id}
                        className="mt-3 rounded-2xl border border-border bg-surface p-4">
                        <Text className="font-bold text-foreground">
                          {receipt.receiptNumber} · {receipt.title}
                        </Text>
                        <Text className="mt-1 text-sm text-primary">
                          {money(receipt.totalAmount)}
                        </Text>
                        <Text className="mt-1 text-xs text-secondary">
                          {receipt.payerName} → {receipt.payeeName} · {date(receipt.issuedAt)}
                        </Text>
                        <Text className="mt-1 text-xs text-muted-foreground">
                          PDF:{' '}
                          {receipt.pdfStatus === 'READY'
                            ? 'Đã sẵn sàng'
                            : receipt.pdfStatus === 'FAILED'
                              ? 'Tạo thất bại'
                              : 'Đang tạo'}
                        </Text>
                        <Button
                          label="Xem khoản thanh toán"
                          onPress={() => void openPayment(receipt.paymentId)}
                        />
                        {receipt.pdfStatus === 'READY' || receipt.pdfStatus === 'FAILED' ? (
                          <Button
                            label={receipt.pdfStatus === 'READY' ? 'Mở / Lưu PDF' : 'Tạo lại PDF'}
                            onPress={() => void receiptAction(receipt)}
                          />
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text className="mt-3 text-sm text-muted-foreground">
                      {moreReceipts
                        ? 'Chưa thấy trong các trang đã tải. Tải thêm để tìm tiếp.'
                        : 'Không có chứng từ phù hợp bộ lọc.'}
                    </Text>
                  ))}
                {moreReceipts ? (
                  <Button
                    label="Tải thêm chứng từ"
                    onPress={() => void loadMoreReceipts()}
                    disabled={detailLoading}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            <Text className="text-sm text-muted-foreground">
              Chọn hợp đồng để xem hóa đơn theo kỳ và các phiếu xác nhận thanh toán.
            </Text>
            <Text className="mb-2 text-xs text-muted-foreground">
              {visibleContracts.length} hợp đồng phù hợp{hasMore ? ' trong các trang đã tải' : ''}
            </Text>
            {visibleContracts.map((contract) => (
              <Pressable
                key={contract.id}
                onPress={() => {
                  setQuery('');
                  setItemStatus(null);
                  setPaymentType(null);
                  setDirection(null);
                  setPeriod('ALL');
                  setDetailTab('invoices');
                  void openContract(contract);
                }}
                accessibilityRole="button"
                className="mt-3 rounded-2xl border border-border bg-surface p-4">
                <Text className="font-bold text-foreground">{contract.contractNumber}</Text>
                <Text className="mt-1 text-sm text-primary">
                  {statusLabel(contract.status)} · Xem hồ sơ thanh toán →
                </Text>
              </Pressable>
            ))}
            {!loading && !visibleContracts.length && !error ? (
              <Text className="mt-5 text-center text-muted-foreground">
                {hasMore
                  ? 'Chưa thấy trong các trang đã tải. Tải thêm để tìm tiếp.'
                  : 'Không có hợp đồng phù hợp bộ lọc.'}
              </Text>
            ) : null}
            {loading ? <ActivityIndicator className="my-5 text-primary" /> : null}
            {hasMore && !loading ? (
              <Button label="Tải thêm hợp đồng" onPress={() => void loadContracts(page + 1)} />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
