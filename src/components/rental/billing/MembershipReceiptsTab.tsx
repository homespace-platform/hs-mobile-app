// Web components/dashboard/invoices/MembershipReceiptsPanel.tsx: the "Gói hội viên" tab.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import { Skeleton } from '@/components/rental/shared/StateBlocks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { vnDate } from '@/lib/rental/format';
import { discardRentalFile } from '@/services/rental/cache';
import { sharePdf } from '@/services/rental/files';
import {
  membershipReceiptService,
  type MembershipReceipt,
} from '@/services/rental/membership-receipt.service';

import { useAlive, useToast } from './common';
import { receiptFileName } from './logic';

const provider = (p?: string | null) => (p === 'ETH' ? 'Ví ETH' : p === 'SEPAY' ? 'SePay' : '—');
const money = (r: MembershipReceipt) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: r.currency }).format(r.totalAmount);

export default function MembershipReceiptsTab() {
  const [rows, setRows] = useState<MembershipReceipt[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const sequence = useRef({ value: 0 });
  const toast = useToast();
  const isAlive = useAlive();

  const load = useCallback(async () => {
    const token = ++sequence.current.value;
    try {
      const data = await membershipReceiptService.list({ page, size: 12 });
      if (token !== sequence.current.value) return;
      setRows(data.result ?? []);
      setPages(Math.max(1, data.totalPages));
      setError('');
    } catch (cause) {
      if (token === sequence.current.value)
        setError(getApiErrorMessage(cause, 'Chưa tải được biên nhận gói hội viên.'));
    } finally {
      if (token === sequence.current.value) setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    const counter = sequence.current;
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      counter.value++;
      clearInterval(timer);
    };
  }, [load]);

  async function share(row: MembershipReceipt) {
    setBusyId(row.id);
    try {
      const cached = await membershipReceiptService.pdf(row.id);
      if (!isAlive()) return void discardRentalFile(cached);
      const named = `${cached.slice(0, cached.lastIndexOf('/') + 1)}${encodeURIComponent(receiptFileName(row.receiptNumber))}`;
      try {
        await FileSystem.moveAsync({ from: cached, to: named });
        if (isAlive()) await sharePdf(named, isAlive);
      } finally {
        void discardRentalFile(cached);
      }
    } catch (cause) {
      if (isAlive()) toast.error(getApiErrorMessage(cause, 'Chưa tải được PDF.'));
    } finally {
      if (isAlive()) setBusyId(null);
    }
  }
  async function retry(row: MembershipReceipt) {
    setBusyId(row.id);
    try {
      await membershipReceiptService.retry(row.id);
      if (isAlive()) toast.info('Đã xếp hàng tạo lại PDF.');
      await load();
    } catch (cause) {
      if (isAlive()) toast.error(getApiErrorMessage(cause, 'Chưa thể tạo lại PDF.'));
    } finally {
      if (isAlive()) setBusyId(null);
    }
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
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
            <View key={row.id} className="gap-2 border-b border-border px-4 py-3">
              <View className="flex-row items-baseline gap-3">
                <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-foreground">
                  {row.itemName}
                </Text>
                <Text className="text-sm font-bold text-primary">{money(row)}</Text>
              </View>
              <Text selectable className="font-mono text-xs text-muted-foreground">
                {row.receiptNumber}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {provider(row.provider)} · {vnDate(row.issuedAt)}
              </Text>
              {row.type === 'OVERPAYMENT' ? (
                <Text className="text-xs font-semibold text-warning">
                  {row.refundStatus === 'REFUNDED' ? 'Đã hoàn tiền' : 'Trả thừa – sẽ được hoàn lại'}
                </Text>
              ) : null}
              {row.pdfStatus === 'READY' ? (
                <ActionButton
                  label="Tải PDF"
                  icon="download-outline"
                  variant="secondary"
                  busy={busyId === row.id}
                  onClick={() => void share(row)}
                />
              ) : row.pdfStatus === 'PENDING' ? (
                <Text className="text-sm font-semibold text-primary">Đang tạo PDF</Text>
              ) : (
                <ActionButton
                  label="Thử tạo lại PDF"
                  variant="secondary"
                  busy={busyId === row.id}
                  onClick={() => void retry(row)}
                />
              )}
            </View>
          ))}
        </View>
      )}
      {pages > 1 ? (
        <View className="flex-row items-center justify-between gap-3">
          <ActionButton
            label="Trước"
            variant="secondary"
            disabled={loading || page <= 1}
            onClick={() => setPage(page - 1)}
          />
          <Text className="text-sm text-foreground">
            Trang {page} / {pages}
          </Text>
          <ActionButton
            label="Tiếp"
            variant="secondary"
            disabled={loading || page >= pages}
            onClick={() => setPage(page + 1)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
