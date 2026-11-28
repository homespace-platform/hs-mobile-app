// Web components/dashboard/invoices/ReceiptRow.tsx + components/common/Pagination.tsx: one receipt row and the
// pager, identical on the "Thuê nhà" and "Gói hội viên" tabs.
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import { clampPage } from '@/lib/pagination';
import { discardRentalFile } from '@/services/rental/cache';
import { sharePdf } from '@/services/rental/files';

import { receiptFileName } from './logic';

export type PdfState = 'READY' | 'PENDING' | 'FAILED';

/** Names the cached PDF like the web download and opens the share sheet; the cached copy is always removed. */
export async function shareReceiptPdf(cached: string, receiptNumber: string, isAlive: () => boolean) {
  if (!isAlive()) return void discardRentalFile(cached);
  const named = `${cached.slice(0, cached.lastIndexOf('/') + 1)}${encodeURIComponent(receiptFileName(receiptNumber))}`;
  try {
    await FileSystem.moveAsync({ from: cached, to: named });
    if (isAlive()) await sharePdf(named, isAlive);
  } finally {
    void discardRentalFile(cached);
  }
}

export function ReceiptRow({
  icon,
  title,
  subtitle,
  amount,
  status,
  pdfStatus,
  busy,
  onView,
  onPdf,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle: string;
  amount: string;
  /** Status badge under the amount; a PDF that is still being made shows "Đang tạo PDF" instead. */
  status: ReactNode;
  pdfStatus: PdfState;
  busy?: boolean;
  onView: () => void;
  onPdf: () => void;
}) {
  const ready = pdfStatus === 'READY';
  return (
    <View className="gap-3 border-b border-border px-4 py-3">
      <View className="flex-row items-start gap-3">
        <Icon name={icon} size={20} className="text-primary" />
        <View className="flex-1 gap-1">
          <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
            {title}
          </Text>
          <Text className="text-xs leading-5 text-muted-foreground">{subtitle}</Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-sm font-bold text-primary">{amount}</Text>
          {pdfStatus === 'PENDING' ? (
            <Text className="text-xs font-semibold text-primary">Đang tạo PDF</Text>
          ) : (
            status
          )}
        </View>
      </View>
      <View className="flex-row gap-2">
        <ActionButton
          label="Xem"
          icon="eye-outline"
          variant="secondary"
          onClick={onView}
          hint={`Xem biên nhận ${title}`}
          className="flex-1"
        />
        <ActionButton
          label="Tải PDF"
          icon="download-outline"
          variant="secondary"
          disabled={!ready}
          busy={busy}
          onClick={onPdf}
          hint={
            ready
              ? `Tải PDF ${title}`
              : pdfStatus === 'FAILED'
                ? 'PDF chưa tạo được. Mở Xem để thử lại.'
                : 'PDF đang được tạo'
          }
          className="flex-1"
        />
      </View>
    </View>
  );
}

const PAGER = [
  ['first', 'Trang đầu', 'play-skip-back-outline'],
  ['prev', 'Trang trước', 'chevron-back'],
  ['next', 'Trang sau', 'chevron-forward'],
  ['last', 'Trang cuối', 'play-skip-forward-outline'],
] as const;

/** « ‹ Trang X / Y · N giao dịch › » */
export function ReceiptPager({
  page,
  pages,
  total,
  disabled,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  disabled?: boolean;
  onPage: (page: number) => void;
}) {
  const current = clampPage(page, pages);
  const target = { first: 1, prev: current - 1, next: current + 1, last: pages };
  const off = (key: string) =>
    Boolean(disabled) || ((key === 'first' || key === 'prev') && current <= 1) || ((key === 'next' || key === 'last') && current >= pages);
  const button = ([key, label, icon]: (typeof PAGER)[number]) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off(key) }}
      disabled={off(key)}
      onPress={() => onPage(clampPage(target[key], pages))}
      className={`h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface active:opacity-80 ${off(key) ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={18} className="text-foreground" />
    </Pressable>
  );
  return (
    <View accessibilityRole="toolbar" accessibilityLabel="Phân trang" className="flex-row items-center justify-between gap-2">
      {PAGER.slice(0, 2).map(button)}
      <Text className="flex-1 text-center text-xs text-foreground">
        Trang {current} / {pages} · {total} giao dịch
      </Text>
      {PAGER.slice(2).map(button)}
    </View>
  );
}
