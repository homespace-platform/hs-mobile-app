// Web components/contract/detail/SettlementPaymentPanel.tsx (+ DepositAdjustmentPayments).
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import Badge from '@/components/rental/shared/Badge';
import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { useNotificationChangeSync, useVisiblePoll } from '@/lib/rental-sync/hooks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { vnDateTime } from '@/lib/rental/format';
import { paymentStatus } from '@/lib/rental/rental-labels';
import { withFileLease } from '@/services/rental/cache';
import { paymentRequestService } from '@/services/rental/payment-request.service';
import storageService from '@/services/rental/storage.service';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

import {
  LineInput,
  LinkButton,
  Notice,
  ProofField,
  StorageLinks,
  useActionLock,
  useAlive,
  useToast,
} from './common';
import {
  assertSameReview,
  createSingleFlight,
  dong,
  PROOF_MAX_BYTES,
  proofFor,
  reviewStamp,
  sendSettlementProof,
  SETTLEMENT_PROOF_INVALID,
  settlementState,
  type BoundProof,
} from './logic';
import PaymentReceiptActions from './PaymentReceiptActions';

/** Mount with key={payment.id}. */
export default function SettlementPaymentPanel({
  payment,
  isLandlord,
  refresh,
}: {
  payment: PaymentRequest;
  isLandlord: boolean;
  refresh: () => Promise<void>;
}) {
  const lock = useActionLock();
  const isAlive = useAlive();
  const toast = useToast();
  const { confirm } = useActionDialog();
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<BoundProof | undefined>();
  useDiscardDroppedFiles([proof?.file]);
  // The reason belongs to the report it was typed for: a newer report starts empty.
  const stamp = reviewStamp(payment);
  const [draft, setDraft] = useState({ stamp, text: '' });
  const reason = draft.stamp === stamp ? draft.text : '';
  const state = settlementState(payment, isLandlord);
  const status = paymentStatus(payment.status);
  const bank = payment.payeeBankAccountSnapshot;

  const perform = (action: () => Promise<unknown>, reloadOnError = false) =>
    void lock.run(async () => {
      if (!isAlive()) return;
      setBusy(true);
      try {
        await action();
        if (!isAlive()) return;
        await refresh();
        if (isAlive()) toast.success('Đã cập nhật khoản quyết toán.');
      } catch (error) {
        if (isAlive()) toast.error(getApiErrorMessage(error, 'Chưa thể cập nhật thanh toán.'));
        // After a failed report, show what the server actually recorded.
        if (reloadOnError && isAlive()) await refresh();
      } finally {
        if (isAlive()) setBusy(false);
      }
    });

  function report() {
    const file = proofFor(proof, payment);
    if (!file || file.sizeBytes > PROOF_MAX_BYTES) {
      toast.error(SETTLEMENT_PROOF_INVALID);
      return;
    }
    perform(async () => {
      await withFileLease([file.uri], () =>
        sendSettlementProof(payment, {
          read: paymentRequestService.getPaymentRequest,
          upload: (paymentId) => storageService.uploadPaymentProof(file, paymentId),
          report: (id, body) => paymentRequestService.reportTransfer(id, body),
          isAlive,
        })
      );
      // Stricter than web, which keeps the sent file and would send it again after a rejection.
      if (isAlive()) setProof(undefined);
    }, true);
  }

  async function receive() {
    if (lock.held) return;
    const ok = await confirm({
      title: 'Xác nhận đã nhận tiền?',
      description: `Chỉ xác nhận khi tài khoản của bạn đã nhận đủ ${dong(payment.totalAmount)}.`,
      confirmLabel: 'Đã nhận đủ',
      tone: 'warning',
    });
    if (ok && isAlive())
      perform(async () => {
        await assertSameReview(payment, paymentRequestService.getPaymentRequest);
        await paymentRequestService.confirmReceipt(payment.id);
      });
  }

  const reject = () =>
    perform(async () => {
      await assertSameReview(payment, paymentRequestService.getPaymentRequest);
      // As web: the reason is sent as typed.
      await paymentRequestService.rejectReceipt(payment.id, { reason });
    });

  const confirmedAt = payment.payeeConfirmedAt || payment.confirmedAt;
  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
      <View className="gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          {state.title}
        </Text>
      </View>
      <InfoRow
        label="Số tiền"
        value={`${dong(payment.totalAmount)}${payment.status === 'OVERDUE' ? ' · Đã quá hạn nhưng vẫn phải thanh toán' : ''}`}
        strong
      />
      {payment.status === 'CONFIRMED' ? (
        <Text className="text-sm leading-6 text-success">
          Đã xác nhận nhận đủ tiền{confirmedAt ? ` · ${vnDateTime(confirmedAt)}` : ''}.
        </Text>
      ) : null}
      <Accordion
        key={String(state.detailsOpen)}
        title="Thông tin chuyển khoản & chứng từ"
        defaultOpen={state.detailsOpen}>
        <View className="gap-3">
          {payment.status !== 'CONFIRMED' ? (
            <Text className="text-sm leading-6 text-muted-foreground">
              Hạn thanh toán: {payment.dueAt ? vnDateTime(payment.dueAt) : '—'}. Bên nhận cần kiểm
              tra tài khoản và xác nhận nhận tiền.
            </Text>
          ) : null}
          <Text selectable className="text-sm leading-6 text-foreground">
            {bank?.bankName} · STK: <Text className="font-bold">{bank?.accountNumber}</Text> ·{' '}
            {bank?.accountHolderName}
          </Text>
          <Text selectable className="text-sm leading-6 text-foreground">
            Nội dung chuyển khoản: <Text className="font-bold">{payment.transferReference}</Text>
          </Text>
          {state.canTransfer && payment.qrImageUrl ? (
            <Image
              source={{ uri: payment.qrImageUrl }}
              accessible
              accessibilityLabel="QR quyết toán"
              resizeMode="contain"
              className="h-[180px] w-[180px] self-center rounded-xl border border-border bg-muted"
            />
          ) : null}
          {state.canTransfer ? (
            <ProofField
              label="Chứng từ quyết toán"
              sizeMessage={SETTLEMENT_PROOF_INVALID}
              payment={payment}
              proof={proof}
              onProof={setProof}
              busy={busy}
              onSend={report}
            />
          ) : null}
          <StorageLinks
            ids={payment.evidences?.map((evidence) => evidence.storageObjectId)}
            label="Xem chứng từ"
            fallback="Không mở được chứng từ."
          />
          {state.canReceive ? (
            <View className="gap-3">
              <ActionButton
                label="Xác nhận đã nhận tiền"
                variant="success"
                icon="checkmark-circle-outline"
                disabled={busy}
                onClick={() => void receive()}
              />
              <LineInput
                value={reason}
                onChangeText={(text) => setDraft({ stamp, text })}
                disabled={busy}
                accessibilityLabel="Lý do từ chối chứng từ"
                placeholder="Lý do chưa chấp nhận (từ 10 ký tự)"
              />
              <ActionButton
                label="Không chấp nhận chứng từ"
                variant="danger"
                disabled={busy || reason.trim().length < 10}
                onClick={reject}
              />
            </View>
          ) : null}
          {payment.rejectedReason ? (
            <Text className="text-sm leading-6 text-danger">
              Lý do không chấp nhận chứng từ: {payment.rejectedReason}
            </Text>
          ) : null}
        </View>
      </Accordion>
      {state.showReceipt ? <PaymentReceiptActions paymentId={payment.id} /> : null}
    </View>
  );
}

/** Mount with key={contractId}. */
export function DepositAdjustmentPayments({
  contractId,
  isLandlord,
}: {
  contractId: string;
  isLandlord: boolean;
}) {
  const [rows, setRows] = useState<PaymentRequest[]>([]);
  const [error, setError] = useState('');
  const isAlive = useAlive();
  const [refresh] = useState(() =>
    createSingleFlight(async () => {
      try {
        const payments = await paymentRequestService.getContractPayments(contractId);
        if (!isAlive()) return;
        setRows(
          payments.filter((p) => p.type === 'DEPOSIT_ADJUSTMENT' && p.contractId === contractId)
        );
        setError('');
      } catch (cause) {
        if (isAlive()) setError(getApiErrorMessage(cause, 'Chưa tải được khoản chênh lệch cọc.'));
      }
    }, isAlive)
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useVisiblePoll(refresh, 30_000);
  useNotificationChangeSync(
    (event) =>
      event.type === 'payment-changed' ||
      (event.type === 'agreement-changed' &&
        (!event.agreementId || event.agreementId === contractId)),
    refresh
  );
  return (
    <View accessibilityLabel="Điều chỉnh tiền cọc" className="gap-3">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          Chênh lệch cọc theo phụ lục
        </Text>
        <LinkButton label="Làm mới khoản cọc" onPress={() => void refresh()} />
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm leading-6 text-danger">
          {error}
        </Text>
      ) : !rows.length ? (
        <PolicyNotice
          tone="neutral"
          title="Chênh lệch cọc theo phụ lục"
          summary="Chưa có khoản điều chỉnh cọc.">
          <Notice>
            Chưa có khoản điều chỉnh cọc. Khi phụ lục đủ chữ ký và đến ngày hiệu lực, phần cọc cần
            bổ sung hoặc hoàn được quản lý tại đây.
          </Notice>
        </PolicyNotice>
      ) : (
        rows.map((payment) => (
          <SettlementPaymentPanel
            key={payment.id}
            payment={payment}
            isLandlord={isLandlord}
            refresh={refresh}
          />
        ))
      )}
    </View>
  );
}
