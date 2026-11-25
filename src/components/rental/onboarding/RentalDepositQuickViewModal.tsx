// Web: components/rental-request/RentalDepositQuickViewModal.tsx (landlord quick view and list strip).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import Badge from '@/components/rental/shared/Badge';
import { Card } from '@/components/rental/shared/Card';
import InfoRow from '@/components/rental/shared/InfoRow';
import ModalShell from '@/components/rental/shared/ModalShell';
import { LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { instant } from '@/lib/rental/RentalOnboardingPanel';
import {
  canReviewReservationReceipt,
  paymentSummaryTitle,
  reservationPaymentStatus,
  reservationPaymentTitle,
  selectOnboardingPayment,
} from '@/lib/rental/rental-deposit-quick-view';
import { paymentStatus } from '@/lib/rental/rental-labels';
import { readOnboarding } from '@/lib/rental/rental-onboarding-read';
import { formatVND } from '@/lib/rental/rental-request.helper';
import paymentService from '@/services/rental/payment-request.service';
import {
  rentalOnboardingService,
  type RentalOnboarding,
} from '@/services/rental/rental-onboarding.service';
import storageService from '@/services/rental/storage.service';
import type { PaymentRequest } from '@/types/rental/payment-request.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { ChoiceButton, myUserId, openUrl, ToneBox, useToast } from './common';
import { loadQuickView } from './logic';

/** List-card strip for the landlord when a transfer waits for confirmation. */
export function RentalReceiptNotice({
  request,
  onOpen,
}: {
  request: RentalRequestResponse;
  onOpen: () => void;
}) {
  const payment = request.initialPayment;
  if (request.status !== 'ACCEPTED' || payment?.status !== 'TRANSFER_REPORTED') return null;
  const line = 'text-xs leading-5 text-foreground';
  return (
    <ToneBox tone="warning">
      <View accessibilityLabel="Khoản chuyển chờ xác nhận" className="gap-1">
        <Text className="text-sm font-semibold text-warning">
          {paymentSummaryTitle(payment)} · Khách đã báo chuyển, chờ bạn xác nhận
        </Text>
        <Text className="text-xl font-bold text-foreground">{formatVND(payment.totalAmount)}</Text>
        {payment.transferReference ? (
          <Text selectable className={line}>
            Nội dung chuyển khoản: {payment.transferReference}
          </Text>
        ) : null}
        {payment.payerReportedAt ? (
          <Text className={line}>
            Báo chuyển: {instant(payment.payerReportedAt)} (giờ Việt Nam)
          </Text>
        ) : null}
        {payment.confirmationDueAt ? (
          <Text className={line}>
            Hạn xác nhận: {instant(payment.confirmationDueAt)} (giờ Việt Nam)
          </Text>
        ) : null}
        <Text className={line}>
          Báo chuyển chưa có nghĩa đã nhận tiền. Đối chiếu chứng từ và tài khoản trước khi xác nhận.
        </Text>
      </View>
      <ActionButton label="Kiểm tra & xác nhận" onClick={onOpen} />
    </ToneBox>
  );
}

export function ReservationReceipt({
  payment,
  actorId,
  isLandlord,
  busy = false,
  onConfirm,
  onReject,
  onProof,
}: {
  payment: PaymentRequest;
  actorId: string | null;
  isLandlord: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onProof: (storageId: string) => void;
}) {
  const review = canReviewReservationReceipt(payment, actorId, isLandlord);
  const account = payment.payeeBankAccountSnapshot || payment.payeeAccount;
  return (
    <View className="gap-4">
      <View className="gap-2 rounded-2xl border border-primary-border bg-primary-soft p-4">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          {reservationPaymentTitle(payment)}
        </Text>
        <Badge tone={paymentStatus(payment.status).tone}>{reservationPaymentStatus(payment)}</Badge>
        <Text selectable className="text-2xl font-extrabold text-primary">
          {formatVND(payment.totalAmount)}
        </Text>
        {payment.type === 'RESERVATION_DEPOSIT' ? (
          <Text className="text-sm text-muted-foreground">
            Khoản này chỉ là cọc giữ chỗ, không gồm tiền thuê tháng đầu.
          </Text>
        ) : null}
        {payment.type === 'INITIAL'
          ? payment.lineItems?.map((line) => (
              <InfoRow key={line.id} label={line.displayName} value={formatVND(line.amount)} />
            ))
          : null}
      </View>
      <Card>
        <InfoRow label="Nội dung chuyển khoản" value={payment.transferReference || '—'} />
        <InfoRow label="Khách báo chuyển lúc" value={instant(payment.payerReportedAt)} />
        <InfoRow label="Hạn báo chuyển" value={instant(payment.dueAt)} />
        <InfoRow
          label={payment.status === 'CONFIRMED' ? 'Đã xác nhận lúc' : 'Hạn xác nhận'}
          value={instant(
            payment.status === 'CONFIRMED' ? payment.confirmedAt : payment.confirmationDueAt
          )}
        />
        {account ? (
          <InfoRow
            label="Tài khoản nhận tiền"
            value={`${account.bankName} · ${account.accountNumber} · ${account.accountHolderName}`}
            stacked
          />
        ) : null}
      </Card>
      <Card className="gap-3">
        <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
          Chứng từ người thuê đã gửi
        </Text>
        {payment.evidences?.length ? (
          payment.evidences.map((e, index) => (
            <View key={e.id} className="gap-1">
              <ActionButton
                label={`Xem chứng từ ${index + 1}`}
                icon="eye-outline"
                variant="secondary"
                disabled={busy}
                onClick={() => onProof(e.storageObjectId)}
              />
              {e.bankTransactionReference ? (
                <Text selectable className="text-sm text-foreground">
                  Mã giao dịch: {e.bankTransactionReference}
                </Text>
              ) : null}
              {e.note ? <Text className="text-sm text-muted-foreground">{e.note}</Text> : null}
            </View>
          ))
        ) : (
          <Text className="text-sm text-muted-foreground">Chưa có chứng từ.</Text>
        )}
      </Card>
      {payment.rejectedReason ? (
        <Card>
          <Text className="text-sm leading-6 text-foreground">
            Lý do chưa xác nhận: {payment.rejectedReason}
          </Text>
        </Card>
      ) : null}
      {review ? (
        <ToneBox tone="warning">
          <Text className="text-sm leading-6 text-warning">
            Đối chiếu chứng từ và tài khoản ngân hàng. Chỉ xác nhận khi bạn đã thực nhận đủ{' '}
            {formatVND(payment.totalAmount)}; báo chuyển chưa có nghĩa đã nhận tiền.
          </Text>
          <ActionButton label="Xác nhận đã nhận đủ tiền" disabled={busy} onClick={onConfirm} />
          <ActionButton
            label="Chưa nhận đủ / Từ chối chứng từ"
            variant="secondary"
            disabled={busy}
            onClick={onReject}
          />
        </ToneBox>
      ) : null}
      {['REJECTED', 'EXPIRED', 'OVERDUE'].includes(payment.status) ? (
        <Text className="text-sm leading-6 text-muted-foreground">
          Cần xem thêm? Mở chi tiết yêu cầu để xử lý theo tiến trình nhận nhà.
        </Text>
      ) : null}
    </View>
  );
}

export type RentalDepositQuickViewModalProps = {
  request: RentalRequestResponse;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
  onOpenDetail: () => void;
};

export default function RentalDepositQuickViewModal(props: RentalDepositQuickViewModalProps) {
  return <QuickViewBody key={props.request.id} {...props} />;
}

type Loaded = { view: RentalOnboarding; payment: PaymentRequest; userId: string };

function QuickViewBody({
  request,
  onClose,
  onUpdated,
  onOpenDetail,
}: RentalDepositQuickViewModalProps) {
  const toast = useToast();
  const { confirm, askReason } = useActionDialog();
  const alive = useRef(false);
  const sequence = useRef(0);
  const actionLock = useRef(false);
  const retainedPaymentId = useRef<string | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // `paymentId` is the chosen chip; without it the last shown payment is kept.
  const load = useCallback(
    async (sync = true, paymentId: string | null = retainedPaymentId.current) => {
      const seq = ++sequence.current;
      const userId = await myUserId();
      const next = await loadQuickView(
        {
          readView: (id) => (sync ? rentalOnboardingService.refresh(id) : readOnboarding(id)),
          getPayment: (id) => paymentService.getPaymentRequest(id),
        },
        { requestId: request.id, userId, paymentId }
      );
      if (alive.current && seq === sequence.current) {
        retainedPaymentId.current = next.payment.id;
        setData({ ...next, userId });
        setError('');
      }
    },
    [request.id]
  );

  useEffect(() => {
    alive.current = true;
    void load()
      .catch((e) => {
        if (alive.current) setError(getApiErrorMessage(e, 'Không tải được khoản thanh toán.'));
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, [load]);

  async function reload(sync: boolean, paymentId?: string) {
    setLoading(true);
    try {
      await load(sync, paymentId);
    } catch (e) {
      if (alive.current) setError(getApiErrorMessage(e, 'Không tải được khoản thanh toán.'));
    } finally {
      if (alive.current) setLoading(false);
    }
  }
  const refresh = () => {
    if (!actionLock.current) void reload(true);
  };
  function selectPayment(id: string) {
    if (
      actionLock.current ||
      loading ||
      !data ||
      id === data.payment.id ||
      !selectOnboardingPayment(data.view.payments, request.id, id)
    )
      return;
    // The old payment must not stay actionable while the chosen one loads.
    setData(null);
    retainedPaymentId.current = id;
    void reload(true, id);
  }

  async function decide(received: boolean) {
    if (
      actionLock.current ||
      loading ||
      error ||
      !data ||
      !canReviewReservationReceipt(data.payment, data.userId, true)
    )
      return;
    const target = data;
    let reason = '';
    if (received) {
      if (
        !(await confirm({
          title: 'Xác nhận đã nhận đủ tiền?',
          confirmLabel: 'Đã nhận đủ tiền',
          description: `Bạn xác nhận đã thực nhận đủ ${formatVND(target.payment.totalAmount)} vào tài khoản ngân hàng. Báo chuyển chưa có nghĩa đã nhận tiền.`,
        }))
      )
        return;
    } else {
      const answer = await askReason({
        title: 'Chưa nhận đủ tiền / từ chối chứng từ',
        label: 'Lý do',
        minLength: 1,
        tone: 'warning',
        confirmLabel: 'Gửi lý do',
        description: 'Người thuê sẽ nhận được lý do này và gửi lại chứng từ.',
      });
      if (!answer) return;
      reason = answer;
    }
    if (actionLock.current || !alive.current) return;
    actionLock.current = true;
    setBusy(true);
    sequence.current++;
    try {
      const payment = received
        ? await paymentService.confirmReceipt(target.payment.id)
        : await paymentService.rejectReceipt(target.payment.id, { reason });
      if (alive.current) setData({ ...target, payment });
      toast.success(received ? 'Đã xác nhận nhận đủ tiền.' : 'Đã ghi nhận từ chối chứng từ.');
      const updates = await Promise.allSettled([load(false), Promise.resolve().then(onUpdated)]);
      if (alive.current && updates.some((result) => result.status === 'rejected'))
        setError(
          'Thao tác đã được ghi nhận nhưng chưa làm mới được dữ liệu. Vui lòng bấm Làm mới.'
        );
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không thể cập nhật khoản thanh toán.'));
      try {
        await load(false);
      } catch {
        if (alive.current)
          setError('Chưa cập nhật được trạng thái; hãy làm mới trước khi tiếp tục.');
      }
    } finally {
      actionLock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function proof(storageId: string) {
    try {
      await openUrl(await storageService.getPaymentProofViewUrl(storageId));
    } catch {
      toast.error('Không mở được chứng từ hoặc bạn không có quyền truy cập.');
    }
  }

  return (
    <ModalShell
      title="Xem nhanh thanh toán"
      icon="card-outline"
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <>
          <ActionButton
            label="Làm mới"
            icon="refresh"
            variant="secondary"
            disabled={busy || loading}
            onClick={refresh}
          />
          <ActionButton
            label="Chi tiết yêu cầu"
            variant="secondary"
            disabled={busy}
            onClick={onOpenDetail}
          />
          <ActionButton label="Đóng" variant="secondary" disabled={busy} onClick={onClose} />
        </>
      }>
      <View className="gap-4">
        <Text className="text-base font-bold text-foreground">{request.listingTitle}</Text>
        {error ? (
          <ToneBox tone="warning" alert>
            {error}
          </ToneBox>
        ) : null}
        {loading || (!data && !error) ? (
          <LoadingBlock label="Đang tải khoản thanh toán…" />
        ) : data ? (
          <>
            <Text className="text-sm leading-6 text-muted-foreground">
              Người thuê: {request.renterName} · Ngày vào ở:{' '}
              {data.view.startsOn.split('-').reverse().join('/')} · Cập nhật{' '}
              {instant(data.view.serverNow)} (giờ Việt Nam)
            </Text>
            <View accessibilityLabel="Chọn khoản thanh toán" className="gap-2">
              {data.view.payments
                .filter((p) => selectOnboardingPayment([p], request.id, p.id))
                .map((p) => (
                  <ChoiceButton
                    key={p.id}
                    label={`${reservationPaymentTitle(p)} · ${reservationPaymentStatus(p)}`}
                    selected={p.id === data.payment.id}
                    disabled={busy}
                    onPress={() => selectPayment(p.id)}
                  />
                ))}
            </View>
            <ReservationReceipt
              payment={data.payment}
              actorId={data.userId}
              isLandlord={data.view.askerRole === 'LANDLORD'}
              busy={busy || !!error}
              onConfirm={() => void decide(true)}
              onReject={() => void decide(false)}
              onProof={(id) => void proof(id)}
            />
          </>
        ) : null}
      </View>
    </ModalShell>
  );
}
