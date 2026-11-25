// Web: components/contract/detail/ListingSyncControl.tsx.
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/rental/onboarding/common';
import ActionButton from '@/components/rental/shared/ActionButton';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { contractService } from '@/services/rental/contract.service';
import type { ContractListingSyncPreview } from '@/types/rental/contract.type';

export default function ListingSyncControl({
  contractId,
  baseRevisionId,
  disabled,
  onSelect,
  onBusyChange,
}: {
  contractId: string;
  baseRevisionId?: string;
  disabled?: boolean;
  /**
   * `notice` is what the web shows in separate toasts before this call. The phone shows one dialog
   * at a time, so the receiver must include it in whatever it announces next.
   */
  onSelect: (source: ContractListingSyncPreview, notice?: string) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [contractId]
  );

  async function update() {
    if (disabled || !baseRevisionId || pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setLoading(true);
    onBusyChange?.(true);
    try {
      const source = await contractService.previewListingSync(contractId, request.signal);
      if (request.signal.aborted) return;
      if (source.baseRevisionId !== baseRevisionId) {
        toast.error('Phiên bản hợp đồng đã thay đổi. Tải lại trang trước khi cập nhật.');
        return;
      }
      const notices: string[] = [];
      if (source.financialDifferences?.length)
        notices.push(
          'Các khoản đã chốt được giữ nguyên: ' +
            source.financialDifferences
              .map((row) => `${row.label}: ${row.before} → ${row.after}`)
              .join('; ') +
            '. Giá bài đăng mới không tự thay thế giá thuê, tiền cọc hoặc kỳ thanh toán đã xác nhận.'
        );
      if (source.leaseMessage) notices.push(source.leaseMessage);
      await onSelect(source, notices.join('\n\n') || undefined);
    } catch (error) {
      if (!request.signal.aborted)
        toast.error(getApiErrorMessage(error, 'Không cập nhật được dữ liệu bài đăng đã duyệt.'));
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setLoading(false);
        onBusyChange?.(false);
      }
    }
  }

  return (
    <ActionButton
      label={loading ? 'Đang cập nhật…' : 'Cập nhật dữ liệu từ bài đăng'}
      variant="secondary"
      icon="sync-outline"
      busy={loading}
      disabled={disabled || !baseRevisionId}
      onClick={() => void update()}
    />
  );
}
