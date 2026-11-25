// Web components/contract/detail/PaymentExtensionPanel.tsx. "Dời hạn thanh toán" moves the due date of ONE
// invoice. It is not "Gia hạn thời gian thuê" (a longer lease).
import { useState } from 'react';
import { Text, View } from 'react-native';

import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { dateTime, money, statuses } from '@/lib/rental/PaymentExtensionPanel';
import { monthlyInvoiceService } from '@/services/rental/monthly-invoice.service';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';

import {
  DaysInput,
  Notice,
  SectionHeading,
  TextArea,
  ToneBox,
  useActionLock,
  useToast,
} from './common';
import { daysValid, EXTENSION_INVALID, extensionState, noteValid, parseDays } from './logic';

export default function PaymentExtensionPanel({
  invoice,
  isLandlord,
  isTenant,
  refresh,
}: {
  invoice: MonthlyInvoice;
  isLandlord: boolean;
  isTenant: boolean;
  refresh: () => Promise<void>;
}) {
  const [days, setDays] = useState('7');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useActionLock();
  const toast = useToast();
  const { confirm } = useActionDialog();
  const { history, pending, approved, resumedFees, canRequest, canDirect, canDecide, visible } =
    extensionState(invoice, isLandlord, isTenant);
  if (!visible) return null;

  const perform = (action: () => Promise<unknown>, success: string) =>
    lock.run(async () => {
      setBusy(true);
      try {
        await action();
        toast.success(success);
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'Không thể xử lý yêu cầu dời hạn thanh toán.'));
      } finally {
        try {
          await refresh();
        } finally {
          setBusy(false);
        }
      }
    });

  function submit() {
    const count = parseDays(days);
    if (!daysValid(count) || !noteValid(note)) {
      toast.error(EXTENSION_INVALID);
      return;
    }
    void perform(
      () =>
        canRequest
          ? monthlyInvoiceService.requestPaymentExtension(invoice.id, count, note.trim())
          : monthlyInvoiceService.extendPaymentDirectly(invoice.id, count, note.trim()),
      canRequest
        ? 'Đã gửi yêu cầu; phí phạt tạm dừng trong thời gian chờ duyệt.'
        : 'Đã cập nhật hạn thanh toán.'
    );
  }

  async function reject(requestId: string) {
    const ok = await confirm({
      title: 'Từ chối yêu cầu dời hạn?',
      description: 'Phí phạt sẽ được tính bù theo hạn thanh toán hiện tại.',
      confirmLabel: 'Từ chối',
      tone: 'danger',
    });
    if (ok)
      void perform(
        () => monthlyInvoiceService.decidePaymentExtension(invoice.id, requestId, false),
        'Đã từ chối và cập nhật phí.'
      );
  }

  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
      <View className="gap-1">
        <SectionHeading title="Dời hạn thanh toán" icon="calendar-outline" />
        <Text className="text-sm leading-6 text-muted-foreground">
          Dời hạn trả riêng hóa đơn này; khác với “Gia hạn thời gian thuê” (kéo dài hợp đồng).
        </Text>
      </View>
      {invoice.originalDueAt ? (
        <Text className="text-sm leading-6 text-muted-foreground">
          Hạn ban đầu: {dateTime(invoice.originalDueAt)}. Hạn hiện tại:{' '}
          {invoice.dueAt ? dateTime(invoice.dueAt) : '—'}.
        </Text>
      ) : null}
      {resumedFees ? (
        <PolicyNotice
          tone="info"
          title="Phí đã chốt trước khi dời hạn"
          summary="Không tăng phí trong thời gian dời hạn.">
          <Notice>
            Phí đã chốt trước khi dời hạn: {money(resumedFees.frozenLateFee)}. Không tăng phí trong
            thời gian dời hạn. Quá hạn mới, phí tiếp tục tính theo hợp đồng và cộng vào khoản đã
            chốt; trần tổng phí của hóa đơn không đặt lại.
          </Notice>
        </PolicyNotice>
      ) : null}
      {invoice.lateFeeExempt && approved ? (
        <ToneBox tone="success">
          {`Quyết định dời hạn cũ miễn tăng phí cho hóa đơn này. Phí đã chốt là ${money(invoice.lateFeeAmount)}; hệ thống giữ nguyên quyết định cũ, không tự truy thu.`}
        </ToneBox>
      ) : null}
      {pending ? (
        <View className="gap-2 rounded-xl border border-primary-border bg-primary-soft p-3">
          <Text className="text-sm font-bold text-foreground">
            Đang xin dời hạn thêm {pending.days} ngày
          </Text>
          <PolicyNotice
            tone="neutral"
            title="Cách tính số ngày dời hạn"
            summary="Duyệt trước hạn: cộng số ngày vào hạn hiện tại.">
            <Notice>
              Duyệt trước hạn: cộng số ngày vào hạn hiện tại. Đã quá hạn: tính từ lúc chủ nhà đồng
              ý.
            </Notice>
          </PolicyNotice>
          <Text className="text-sm leading-6 text-foreground">{pending.note}</Text>
          <Text className="text-sm leading-6 text-secondary">
            Phản hồi trước: {dateTime(pending.respondBy)}. Phí đã chốt:{' '}
            {money(pending.frozenLateFee)}.
          </Text>
          <PolicyNotice
            tone="neutral"
            title="Yêu cầu dời hạn đang chờ"
            summary="Nếu bị từ chối hoặc hết hạn phản hồi, phí được tính bù từ hạn cũ.">
            <Notice>
              Nếu bị từ chối hoặc hết hạn phản hồi, phí được tính bù từ hạn cũ. Không thể gửi chồng
              yêu cầu để kéo dài việc dừng phạt.
            </Notice>
          </PolicyNotice>
          {canDecide ? (
            <View className="gap-2">
              <ActionButton
                label={`Đồng ý thêm ${pending.days} ngày`}
                disabled={busy}
                onClick={() =>
                  void perform(
                    () =>
                      monthlyInvoiceService.decidePaymentExtension(invoice.id, pending.id, true),
                    'Đã đồng ý dời hạn.'
                  )
                }
              />
              <ActionButton
                label="Từ chối"
                variant="danger"
                disabled={busy}
                onClick={() => void reject(pending.id)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {canRequest || canDirect ? (
        <View className="gap-3">
          <Text className="text-sm leading-6 text-foreground">
            {canRequest
              ? 'Bạn có thể xin thêm thời gian trả hóa đơn này.'
              : 'Phương án thứ ba: dời hạn trả chính hóa đơn này, không chuyển công nợ sang kỳ sau.'}
          </Text>
          <PolicyNotice
            tone="neutral"
            title="Quy tắc dời hạn thanh toán"
            summary="Trong thời gian được dời hạn không tăng phí.">
            <View className="gap-3">
              <Notice>
                Nếu được duyệt trước hạn, số ngày được cộng vào hạn hiện tại; nếu đã quá hạn, tính
                từ lúc chủ nhà đồng ý.
              </Notice>
              <Notice>
                Trong thời gian được dời hạn không tăng phí. Nếu vẫn trả trễ hạn mới, phí tiếp tục
                cộng theo hợp đồng; phí một lần không thu lần hai, phí theo ngày giữ trần tổng 5
                ngày/hóa đơn.
              </Notice>
            </View>
          </PolicyNotice>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-foreground">Số ngày (1–30)</Text>
            <DaysInput
              value={days}
              onChange={setDays}
              accessibilityLabel="Số ngày dời hạn thanh toán"
            />
          </View>
          <TextArea
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            accessibilityLabel="Lý do dời hạn thanh toán"
            placeholder="Lý do hoặc thỏa thuận (ít nhất 10 ký tự)"
          />
          <ActionButton
            label={busy ? 'Đang xử lý…' : canRequest ? 'Gửi yêu cầu dời hạn' : 'Dời hạn thanh toán'}
            disabled={busy}
            onClick={submit}
          />
        </View>
      ) : null}
      {history.length > 0 ? (
        <Accordion title={`Lịch sử dời hạn (${history.length})`}>
          <View className="gap-2">
            {[...history].reverse().map((r) => (
              <View key={r.id} className="gap-1 rounded-xl border border-border bg-background p-3">
                <Text className="text-sm font-semibold text-foreground">
                  {statuses[r.status]} · {r.days} ngày · {dateTime(r.requestedAt)}
                </Text>
                {r.newDueAt ? (
                  <Text className="text-sm text-foreground">Hạn mới: {dateTime(r.newDueAt)}</Text>
                ) : null}
                <Text className="text-sm leading-6 text-muted-foreground">{r.note}</Text>
              </View>
            ))}
          </View>
        </Accordion>
      ) : null}
    </View>
  );
}
