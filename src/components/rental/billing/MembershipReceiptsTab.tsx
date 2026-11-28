// Web components/dashboard/invoices/MembershipReceiptsPanel.tsx: the "Gói hội viên" tab.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import PdfViewerModal from '@/components/rental/pdf/PdfViewerModal';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import ModalShell from '@/components/rental/shared/ModalShell';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { Skeleton } from '@/components/rental/shared/StateBlocks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { vnDate, vnDateTime } from '@/lib/rental/format';
import { clampPage, PAGE_SIZE } from '@/lib/pagination';
import {
  membershipReceiptService,
  type MembershipReceipt,
} from '@/services/rental/membership-receipt.service';

import { useAlive, useToast } from './common';
import { ReceiptPager, ReceiptRow, shareReceiptPdf } from './ReceiptRow';

const provider = (p?: string | null) => (p === 'ETH' ? 'Ví ETH' : p === 'SEPAY' ? 'SePay' : '—');
const money = (r: MembershipReceipt) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: r.currency }).format(r.totalAmount);
const statusLabel = (r: MembershipReceipt) =>
  r.type === 'OVERPAYMENT'
    ? r.refundStatus === 'REFUNDED'
      ? 'Đã hoàn tiền'
      : 'Trả thừa – sẽ được hoàn lại'
    : 'Đã thanh toán';

export default function MembershipReceiptsTab({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<MembershipReceipt[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sequence = useRef({ value: 0 });
  const toast = useToast();
  const isAlive = useAlive();

  const load = useCallback(
    async (silent = false) => {
      const token = ++sequence.current.value;
      if (!silent) setLoading(true);
      try {
        const data = await membershipReceiptService.list({ page, size: PAGE_SIZE });
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
          setError(getApiErrorMessage(cause, 'Chưa tải được biên nhận gói hội viên.'));
      } finally {
        if (token === sequence.current.value) setLoading(false);
      }
    },
    [page]
  );
  // refreshKey is bumped by the screen-level "Làm mới" button.
  useEffect(() => {
    const counter = sequence.current;
    void load();
    const timer = setInterval(() => void load(true), 15_000);
    return () => {
      counter.value++;
      clearInterval(timer);
    };
  }, [load, refreshKey]);

  async function share(row: MembershipReceipt) {
    setBusyId(row.id);
    try {
      await shareReceiptPdf(await membershipReceiptService.pdf(row.id), row.receiptNumber, isAlive);
    } catch (cause) {
      if (isAlive()) toast.error(getApiErrorMessage(cause, 'Chưa tải được PDF.'));
    } finally {
      if (isAlive()) setBusyId(null);
    }
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <PolicyNotice
        tone="neutral"
        title="Biên nhận gói hội viên"
        summary="Mỗi giao dịch gói hội viên đã thanh toán có một biên nhận riêng.">
        <Text className="text-sm leading-6 text-muted-foreground">
          Mỗi giao dịch gói hội viên đã thanh toán có một biên nhận riêng. Dữ liệu trên biên nhận
          được giữ nguyên để đối chiếu.
        </Text>
      </PolicyNotice>
      {error ? (
        <Text
          accessibilityRole="alert"
          className="rounded-2xl border border-warning bg-warning-soft p-4 text-sm leading-6 text-warning">
          {error}
        </Text>
      ) : null}
      {loading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : !rows.length && !error ? (
        <View className="items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-8">
          <Icon name="document-text-outline" size={36} className="text-muted-foreground" />
          <Text className="text-center font-bold text-foreground">
            Chưa có biên nhận gói hội viên
          </Text>
          <Text className="text-center text-sm leading-6 text-muted-foreground">
            Biên nhận được tạo ngay khi đơn mua gói hoặc lượt đăng tin được thanh toán thành công.
          </Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((row) => (
            <ReceiptRow
              key={row.id}
              icon="document-text-outline"
              title={row.itemName}
              subtitle={[row.receiptNumber, provider(row.provider), vnDate(row.issuedAt)].join(' · ')}
              amount={money(row)}
              status={
                <Badge tone={row.type === 'OVERPAYMENT' ? 'warning' : 'success'}>
                  {statusLabel(row)}
                </Badge>
              }
              pdfStatus={row.pdfStatus}
              busy={busyId === row.id}
              onView={() => setSelectedId(row.id)}
              onPdf={() => void share(row)}
            />
          ))}
        </View>
      )}
      {!loading && !error && total > 0 ? (
        <ReceiptPager page={page} pages={pages} total={total} onPage={setPage} />
      ) : null}
      {selectedId ? (
        <MembershipReceiptDetail
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => void load(true)}
        />
      ) : null}
    </ScrollView>
  );
}

/** Web MembershipReceiptDialog: detail from GET /membership/receipts/{id} plus the PDF viewer. */
function MembershipReceiptDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const isAlive = useAlive();
  const [receipt, setReceipt] = useState<MembershipReceipt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);
  useEffect(() => {
    let alive = true;
    membershipReceiptService
      .get(id)
      .then((detail) => alive && setReceipt(detail))
      .catch(
        (cause) =>
          alive && setError(getApiErrorMessage(cause, 'Chưa mở được biên nhận. Vui lòng thử lại.'))
      );
    return () => {
      alive = false;
    };
  }, [id]);

  async function download() {
    if (!receipt || busy) return;
    setBusy(true);
    try {
      await shareReceiptPdf(
        await membershipReceiptService.pdf(receipt.id),
        receipt.receiptNumber,
        isAlive
      );
    } catch (cause) {
      if (isAlive()) toast.error(getApiErrorMessage(cause, 'Chưa tải được PDF.'));
    } finally {
      if (isAlive()) setBusy(false);
    }
  }
  async function retry() {
    if (!receipt || busy) return;
    setBusy(true);
    try {
      await membershipReceiptService.retry(receipt.id);
      if (!isAlive()) return;
      toast.info('Đã xếp hàng tạo lại PDF.');
      onChanged();
      onClose();
    } catch (cause) {
      if (isAlive()) toast.error(getApiErrorMessage(cause, 'Chưa thể tạo lại PDF.'));
    } finally {
      if (isAlive()) setBusy(false);
    }
  }
  const line = (label: string, value?: string | number | null) =>
    value ? (
      <Text selectable className="text-sm leading-6 text-muted-foreground">
        {label}: <Text className="font-bold text-foreground">{value}</Text>
      </Text>
    ) : null;

  return (
    <ModalShell title={receipt?.itemName ?? 'Biên nhận gói hội viên'} onClose={onClose}>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm leading-6 text-warning">
          {error}
        </Text>
      ) : !receipt ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <View className="gap-2">
          <Text selectable className="font-mono text-sm text-muted-foreground">
            {receipt.receiptNumber}
          </Text>
          <Text className="text-2xl font-extrabold text-primary">{money(receipt)}</Text>
          <Text className="text-sm font-semibold text-foreground">{statusLabel(receipt)}</Text>
          {line('Loại', receipt.kind === 'PLAN' ? 'Gói hội viên' : 'Lượt đăng tin')}
          {line('Hạng', receipt.tier)}
          {line('Số lượng', receipt.quantity)}
          {line('Thời hạn', receipt.periodDays ? `${receipt.periodDays} ngày` : null)}
          {line('Cổng thanh toán', provider(receipt.provider))}
          {line('Mã giao dịch', receipt.transactionRef)}
          {line('Phát hành', `${vnDateTime(receipt.issuedAt)} (giờ Việt Nam)`)}
          {line('Ghi chú', receipt.note)}
          <View className="mt-2 flex-row flex-wrap gap-2 border-t border-border pt-3">
            {receipt.pdfStatus === 'READY' ? (
              <>
                <ActionButton
                  label="Xem hóa đơn PDF"
                  icon="eye-outline"
                  variant="secondary"
                  onClick={() => setViewing(true)}
                  className="grow"
                />
                <ActionButton
                  label="Tải PDF"
                  icon="download-outline"
                  variant="secondary"
                  busy={busy}
                  onClick={() => void download()}
                  className="grow"
                />
              </>
            ) : receipt.pdfStatus === 'PENDING' ? (
              <Text className="text-sm font-semibold text-primary">Đang tạo PDF…</Text>
            ) : (
              <ActionButton
                label={busy ? 'Đang xử lý…' : 'Thử tạo lại PDF'}
                variant="secondary"
                disabled={busy}
                onClick={() => void retry()}
              />
            )}
          </View>
          {viewing ? (
            <PdfViewerModal
              isOpen
              onClose={() => setViewing(false)}
              title="Biên nhận gói hội viên"
              subtitle={receipt.receiptNumber}
              label={`Biên nhận ${receipt.receiptNumber}`}
              closeLabel="Đóng bản xem PDF"
              documentKey={receipt.id}
              errorText="Chưa mở được biên nhận. Vui lòng thử lại."
              source={() => membershipReceiptService.pdf(receipt.id)}
            />
          ) : null}
        </View>
      )}
    </ModalShell>
  );
}
