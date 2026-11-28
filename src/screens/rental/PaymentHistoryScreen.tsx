// Web app/dashboard/invoices/page.tsx + components/dashboard/invoices/PaymentReceiptsPanel.tsx. The role is
// the side of the Quản lý menu entry (web: the selected dashboard role).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { ScreenHeader } from '@/components/Screen';
import { useAlive, useToast } from '@/components/rental/billing/common';
import { receiptMoney, receiptQuery, receiptSubtitle } from '@/components/rental/billing/logic';
import { ReceiptPager, ReceiptRow, shareReceiptPdf } from '@/components/rental/billing/ReceiptRow';
import MembershipReceiptsTab from '@/components/rental/billing/MembershipReceiptsTab';
import PaymentReceiptActions from '@/components/rental/billing/PaymentReceiptActions';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import ModalShell from '@/components/rental/shared/ModalShell';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { Skeleton } from '@/components/rental/shared/StateBlocks';
import { useVisiblePoll } from '@/lib/rental-sync/hooks';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';
import { clampPage } from '@/lib/pagination';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { vnDate, vnDateTime } from '@/lib/rental/format';
import {
  paymentReceiptService,
  type PaymentReceipt,
} from '@/services/rental/payment-receipt.service';

export type PaymentHistoryScreenProps = RentalScreenNavProps & {
  role: DashboardRole;
  contractId?: string;
};

export default function PaymentHistoryScreen(props: PaymentHistoryScreenProps) {
  const [tab, setTab] = useState<'rent' | 'membership'>('rent');
  // Web: one "Làm mới" above the tabs refreshes whichever tab is open.
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Lịch sử thanh toán" onBack={props.onBack} />
      <View className="items-end px-4 pt-3">
        <ActionButton
          label="Làm mới"
          icon="refresh"
          variant="secondary"
          onClick={() => setRefreshKey((v) => v + 1)}
        />
      </View>
      <View accessibilityRole="tablist" className="flex-row gap-2 px-4 pt-3">
        {(
          [
            ['rent', 'Thuê nhà'],
            ['membership', 'Gói hội viên'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            className={`min-h-11 justify-center rounded-xl border px-4 ${tab === key ? 'border-brand bg-brand' : 'border-border bg-surface'}`}>
            <Text
              className={`text-sm font-semibold ${tab === key ? 'text-on-brand' : 'text-foreground'}`}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'membership' ? (
        <MembershipReceiptsTab refreshKey={refreshKey} />
      ) : (
        /* Web key: another role or contract starts from page 1 with nothing carried over. */
        <Receipts
          key={`${props.role}:${props.contractId ?? ''}`}
          {...props}
          refreshKey={refreshKey}
        />
      )}
    </SafeAreaView>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-sm leading-6 text-muted-foreground">{children}</Text>
);

function Receipts({
  role,
  contractId,
  onNavigate,
  refreshKey,
}: PaymentHistoryScreenProps & { refreshKey: number }) {
  const [rows, setRows] = useState<PaymentReceipt[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Only the newest read may write.
  const sequence = useRef({ value: 0 });
  const retryLock = useRef(false);
  const toast = useToast();
  const isAlive = useAlive();
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(
    async (silent = false) => {
      const token = ++sequence.current.value;
      if (!silent) setLoading(true);
      try {
        const data = await paymentReceiptService.list(receiptQuery(role, contractId, page));
        if (token !== sequence.current.value) return;
        const count = Math.max(1, data.totalPages);
        // A page past the end (rows removed meanwhile) falls back to the last one.
        if (page > count) return void setPage(clampPage(page, count));
        setRows(data.result ?? []);
        setPages(count);
        setTotal(data.totalElements ?? 0);
        setError('');
      } catch (cause) {
        if (token === sequence.current.value)
          setError(getApiErrorMessage(cause, 'Chưa tải được chứng từ thanh toán.'));
      } finally {
        if (token === sequence.current.value) setLoading(false);
      }
    },
    [role, contractId, page]
  );
  useEffect(() => {
    setRows([]);
    const counter = sequence.current;
    void load();
    return () => {
      counter.value++;
    };
  }, [load, refreshKey]);
  useVisiblePoll(() => load(true), 15_000);

  async function share(row: PaymentReceipt) {
    setBusyId(row.id);
    try {
      await shareReceiptPdf(await paymentReceiptService.pdf(row.id), row.receiptNumber, isAlive);
    } catch (cause) {
      if (isAlive()) toast.error(getApiErrorMessage(cause, 'Chưa tải được PDF.'));
    } finally {
      if (isAlive()) setBusyId(null);
    }
  }

  async function retry(row: PaymentReceipt) {
    if (retryLock.current) return;
    retryLock.current = true;
    setRetrying(row.id);
    try {
      const result = await paymentReceiptService.retry(row.id);
      if (!isAlive()) return;
      toast.info(
        result.pdfStatus === 'PENDING'
          ? 'Đã xếp hàng tạo lại PDF.'
          : 'Hệ thống đang chờ lượt thử tiếp theo. Vui lòng thử lại sau ít phút.'
      );
      await load(true);
    } catch (cause) {
      if (isAlive()) toast.error(getApiErrorMessage(cause, 'Chưa thể tạo lại PDF.'));
    } finally {
      retryLock.current = false;
      if (isAlive()) setRetrying(null);
    }
  }

  const go = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  // A row that disappears after a refresh closes its detail.
  const selected = rows.find((row) => row.id === selectedId);

  return (
    <ScrollView ref={scroll} contentContainerClassName="gap-4 p-4">
      <PolicyNotice
        tone="neutral"
        title="Lịch sử thanh toán"
        summary="Mỗi khoản tiền đã được bên nhận xác nhận có một phiếu riêng.">
        <Muted>
          Mỗi khoản tiền đã được bên nhận xác nhận có một phiếu riêng. Dữ liệu trên phiếu được giữ
          nguyên để đối chiếu.
        </Muted>
      </PolicyNotice>
      {contractId ? (
        <View className="flex-row flex-wrap items-center gap-x-3">
          <Text className="text-sm text-muted-foreground">Đang lọc theo một hợp đồng.</Text>
          <Pressable
            onPress={() => onNavigate({ screen: 'payment-history', side: role }, { replace: true })}
            accessibilityRole="button"
            className="min-h-11 justify-center">
            <Text className="text-sm font-bold text-primary underline">Xem tất cả</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          className="rounded-2xl border border-warning bg-warning-soft p-4 text-sm leading-6 text-warning">
          {error}
        </Text>
      ) : null}
      {loading ? (
        <View accessible accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </View>
      ) : !rows.length && !error ? (
        <View className="items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-8">
          <Icon name="document-text-outline" size={36} className="text-muted-foreground" />
          <Text className="text-center font-bold text-foreground">Chưa có chứng từ thanh toán</Text>
          <PolicyNotice
            tone="neutral"
            title="Chưa có chứng từ thanh toán"
            summary="Phiếu được tạo sau khi bên nhận xác nhận đã nhận đủ tiền.">
            <Muted>
              Phiếu được tạo sau khi bên nhận xác nhận đã nhận đủ tiền. Báo chuyển khoản chưa tạo
              phiếu.
            </Muted>
          </PolicyNotice>
        </View>
      ) : (
        <View className="overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((row) => (
            <ReceiptRow
              key={row.id}
              icon={row.kind === 'REFUND' ? 'return-up-back-outline' : 'document-text-outline'}
              title={row.title}
              subtitle={receiptSubtitle({ ...row, day: vnDate(row.issuedAt) })}
              amount={receiptMoney(row)}
              status={<Badge tone="success">Đã xác nhận</Badge>}
              pdfStatus={row.pdfStatus}
              busy={busyId === row.id}
              onView={() => setSelectedId(row.id)}
              onPdf={() => void share(row)}
            />
          ))}
        </View>
      )}
      {!loading && total > 0 ? (
        <ReceiptPager page={page} pages={pages} total={total} onPage={go} />
      ) : null}
      {selected ? (
        <ReceiptDetail
          receipt={selected}
          retrying={retrying === selected.id}
          onRetry={() => void retry(selected)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </ScrollView>
  );
}

function ReceiptDetail({
  receipt,
  retrying,
  onRetry,
  onClose,
}: {
  receipt: PaymentReceipt;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title={receipt.title} onClose={onClose}>
      <View className="gap-2">
        <Text selectable className="font-mono text-sm text-muted-foreground">
          {receipt.receiptNumber}
        </Text>
        <Text className="text-2xl font-extrabold text-primary">{receiptMoney(receipt)}</Text>
        <Text className="text-sm leading-6 text-foreground">
          {receipt.payerName} → {receipt.payeeName}
        </Text>
        <Muted>Xác nhận: {vnDateTime(receipt.issuedAt)} (giờ Việt Nam)</Muted>
        {receipt.propertyAddress ? <Muted>{receipt.propertyAddress}</Muted> : null}
        {receipt.contractNumber ? <Muted>Hợp đồng: {receipt.contractNumber}</Muted> : null}
        {receipt.periodLabel ? <Muted>Kỳ: {receipt.periodLabel}</Muted> : null}
        <Text selectable className="text-sm leading-6 text-muted-foreground">
          Nội dung CK:{' '}
          <Text className="font-mono font-bold text-foreground">{receipt.transferReference}</Text>
        </Text>
        <View className="mt-2 border-t border-border pt-3">
          {receipt.pdfStatus === 'READY' ? (
            <PaymentReceiptActions paymentId={receipt.paymentId} receipt={receipt} />
          ) : receipt.pdfStatus === 'PENDING' ? (
            <Text className="text-sm font-semibold text-primary">Đang tạo PDF…</Text>
          ) : (
            <ActionButton
              label={retrying ? 'Đang xử lý…' : 'Thử tạo lại PDF'}
              variant="secondary"
              disabled={retrying}
              onClick={onRetry}
            />
          )}
        </View>
      </View>
    </ModalShell>
  );
}
