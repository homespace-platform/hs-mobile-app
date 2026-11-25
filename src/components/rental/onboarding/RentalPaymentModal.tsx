// Web: components/rental-request/RentalPaymentModal.tsx. The MOBILE_QR proof source is dropped (Q2).
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import { Card } from '@/components/rental/shared/Card';
import InfoRow from '@/components/rental/shared/InfoRow';
import ModalShell from '@/components/rental/shared/ModalShell';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { toneParts } from '@/components/rental/shared/logic';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { numberVi } from '@/lib/rental/format';
import { paymentTransferPresentation } from '@/lib/rental/payment-transfer-presentation';
import { paymentStatus } from '@/lib/rental/rental-labels';
import { formatVND } from '@/lib/rental/RentalPaymentModal';
import { useNotificationChangeSync, useNowMs } from '@/lib/rental-sync/hooks';
import { discardRentalFile, shareRentalFile, writeRentalFile } from '@/services/rental/cache';
import { paymentRequestService } from '@/services/rental/payment-request.service';
import storageService from '@/services/rental/storage.service';
import type { PaymentRequest } from '@/types/rental/payment-request.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { myUserId, openUrl, ToneBox, useToast } from './common';
import {
  assertViewerPayment,
  createCoalesced,
  createProofFlow,
  EMPTY_PROOF,
  transferReportState,
} from './logic';
import PaymentProofForm from './PaymentProofForm';

export type RentalPaymentModalProps = {
  request: Pick<RentalRequestResponse, 'id'> & Partial<RentalRequestResponse>;
  paymentId?: string;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (payment: PaymentRequest) => void;
};

export default function RentalPaymentModal(props: RentalPaymentModalProps) {
  if (!props.isOpen) return null;
  return <ViewerPaymentModal {...props} />;
}

const LOAD_FAILED = 'Không thể tải thông tin yêu cầu chuyển khoản.';

/** Web mounts the sheet only once `profile.id` is known, and keys it with that id. */
function ViewerPaymentModal(props: RentalPaymentModalProps) {
  const toast = useToast();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const fail = useRef((_error?: unknown) => {});
  fail.current = (error) => {
    toast.error(getApiErrorMessage(error, LOAD_FAILED));
    // No sheet to close by hand: hand the state back so the caller can open it again.
    props.onClose();
  };
  useEffect(() => {
    let alive = true;
    myUserId().then(
      (id) => {
        if (!alive) return;
        if (id) setViewerId(id);
        else fail.current();
      },
      (error) => {
        if (alive) fail.current(error);
      }
    );
    return () => {
      alive = false;
    };
  }, []);
  if (!viewerId) return null;
  return (
    <ScopedPaymentModal
      key={`${viewerId}:${props.request.id}:${props.paymentId ?? 'initial'}`}
      viewerId={viewerId}
      {...props}
    />
  );
}

function ScopedPaymentModal({
  viewerId,
  request,
  paymentId,
  onClose,
  onPaymentSuccess,
}: RentalPaymentModalProps & { viewerId: string }) {
  const toast = useToast();
  const nowMs = useNowMs();
  const [payment, setPayment] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [proof, setProof] = useState(EMPTY_PROOF);
  useDiscardDroppedFiles([proof.file]);
  const alive = useRef(true);
  const scroll = useRef<ScrollView>(null);

  const [flow] = useState(() =>
    createProofFlow({
      upload: (file, id) => storageService.uploadPaymentProof(file, id),
      report: (id, payload) => paymentRequestService.reportTransfer(id, payload),
      onChange: setProof,
      onError: (message) => toast.error(message),
      reload: () => void refresh(),
      isAlive: () => alive.current,
    })
  );

  const [refresh] = useState(() =>
    createCoalesced(
      async () => {
        try {
          const next = assertViewerPayment(
            paymentId
              ? await paymentRequestService.getPaymentRequest(paymentId)
              : await paymentRequestService.getInitialPaymentByRentalRequestId(request.id),
            { paymentId, requestId: request.id, userId: viewerId }
          );
          if (!alive.current) return;
          setPayment(next);
          // Mobile guard, stricter than web: a draft never moves to another payment.
          if (flow.bind(next.id)) setShowReportForm(false);
        } catch (error) {
          if (alive.current) toast.error(getApiErrorMessage(error, LOAD_FAILED));
        } finally {
          if (alive.current) setLoading(false);
        }
      },
      () => alive.current
    )
  );
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  useNotificationChangeSync(
    (event) =>
      event.type === 'payment-changed' &&
      (!event.paymentId || event.paymentId === (paymentId ?? payment?.id)),
    refresh
  );

  const presentation = paymentTransferPresentation(payment);
  const totalAmount = presentation.total;
  const isConfirmed = payment?.status === 'CONFIRMED';
  const isReported = payment?.status === 'TRANSFER_REPORTED';
  const { windowClosed, canReport } = transferReportState(payment, viewerId, nowMs);
  const confirmedText = presentation.refund
    ? 'Người thuê đã xác nhận nhận đủ tiền hoàn'
    : 'Chủ nhà đã xác nhận nhận đủ tiền';

  async function reportTransfer() {
    if (!payment) return;
    const updated = await flow.submit(payment, canReport);
    if (!updated) return;
    setPayment(updated);
    setShowReportForm(false);
    flow.remove();
    toast.success('Đã gửi chứng từ cho bên nhận xác nhận.');
    onPaymentSuccess?.(updated);
  }

  return (
    <ModalShell
      title="Phiếu hướng dẫn chuyển khoản trực tiếp"
      icon="card-outline"
      scrollRef={scroll}
      onClose={onClose}
      headerExtra={
        <Text className="w-full text-xs text-muted-foreground">
          Yêu cầu thuê #{request.id.slice(0, 8).toUpperCase()}
          {payment?.transferReference ? ` • Ref: ${payment.transferReference}` : ''}
        </Text>
      }
      footer={
        <>
          <ActionButton label="Đóng" variant="secondary" onClick={onClose} />
          {!loading && payment && (canReport || isReported) && !showReportForm ? (
            isReported ? (
              <View className="flex-1 flex-row items-center justify-end gap-1.5">
                <Icon name="time-outline" size={18} className="text-warning" />
                <Text className="shrink text-sm font-semibold text-warning">
                  Đang chờ {presentation.recipient} xác nhận
                </Text>
              </View>
            ) : (
              <ActionButton
                label={payment.status === 'REJECTED' ? 'Gửi lại chứng từ' : 'Tôi đã chuyển khoản'}
                icon="cloud-upload-outline"
                className="flex-1"
                onClick={() => {
                  setShowReportForm(true);
                  // The form is the last block: bring it into view once it is laid out.
                  setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250);
                }}
              />
            )
          ) : null}
          {!loading && isConfirmed ? (
            <View className="flex-1 flex-row items-center justify-end gap-1.5">
              <Icon name="checkmark-circle" size={18} className="text-success" />
              <Text className="shrink text-sm font-bold text-success">{confirmedText}</Text>
            </View>
          ) : null}
        </>
      }>
      {loading ? (
        <LoadingBlock label="Đang tải thông tin chuyển khoản..." />
      ) : !payment ? (
        <View className="items-center gap-2 py-12">
          <Icon name="warning-outline" size={32} className="text-warning" />
          <Text className="text-center text-sm text-muted-foreground">
            Chưa có thông tin thanh toán cho yêu cầu thuê này.
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          <ToneBox tone="info">
            <Text className="text-sm font-bold text-foreground">
              Chuyển khoản trực tiếp đến tài khoản {presentation.recipient}
            </Text>
            <PolicyNotice
              title="Chuyển khoản trực tiếp"
              summary="HomeSpace không nhận, giữ hoặc xử lý tiền.">
              <Text className="text-sm leading-6 text-secondary">
                HomeSpace không nhận, giữ hoặc xử lý tiền. Khoản tiền được chuyển trực tiếp đến tài
                khoản của {presentation.recipient}. Vui lòng kiểm tra đúng tên chủ tài khoản trước
                khi chuyển.
              </Text>
            </PolicyNotice>
          </ToneBox>

          {isConfirmed ? (
            <StatusBanner
              status="CONFIRMED"
              icon="checkmark-circle"
              title={confirmedText}
              lines={[
                'Khoản chuyển đã được xác nhận. Xem tiến trình hồ sơ để biết bước tiếp theo.',
              ]}
            />
          ) : null}
          {isReported ? (
            <StatusBanner
              status="TRANSFER_REPORTED"
              icon="time-outline"
              title={`Đã gửi chứng từ — chờ ${presentation.recipient} xác nhận`}
              lines={[
                'Chứng từ chuyển khoản đã được gửi. Bên nhận đang kiểm tra tài khoản ngân hàng để xác nhận giao dịch.',
              ]}
            />
          ) : null}
          {payment.status === 'REJECTED' ? (
            <StatusBanner
              status="REJECTED"
              icon="ban-outline"
              title="Bên nhận chưa nhận được tiền hoặc từ chối chứng từ"
              lines={[
                payment.rejectedReason ? `Lý do từ chối: "${payment.rejectedReason}"` : '',
                windowClosed
                  ? 'Đã quá hạn chuyển khoản nên chưa thể gửi lại chứng từ. Nếu bạn đã chuyển tiền, hãy nhờ chủ nhà đối soát hoặc mở lại thanh toán.'
                  : 'Vui lòng kiểm tra lại biến động số dư tài khoản ngân hàng hoặc đính kèm lại chứng từ chính xác bên dưới.',
              ]}
            />
          ) : null}

          <Card className="gap-2">
            <View className="flex-row items-start gap-2 border-b border-border pb-2">
              <Icon name="receipt-outline" size={18} className="text-primary" />
              <Text accessibilityRole="header" className="flex-1 text-sm font-bold text-foreground">
                {presentation.title}
              </Text>
              <Text className="text-sm font-bold text-foreground">Số tiền</Text>
            </View>
            {presentation.rows.map((item) => (
              <InfoRow key={item.id} label={item.displayName} value={formatVND(item.amount)} />
            ))}
            <PolicyNotice
              tone="neutral"
              title="Ghi chú khoản thanh toán"
              text={
                !presentation.detailed
                  ? 'Chưa có đủ chi tiết phân bổ. Số tiền cần chuyển theo tổng trên yêu cầu này.'
                  : presentation.refund
                    ? 'Khoản hoàn căn cứ tiền thực nhận đã được xác nhận. Hoàn tất khi người thuê xác nhận đã nhận đủ tiền.'
                    : '* Phí dịch vụ cố định, điện/nước theo thực tế và khoản phát sinh được quyết toán vào cuối kỳ thuê, không thu trong khoản ban đầu.'
              }
            />
            <View className="gap-0.5 border-t border-border pt-3">
              <Text className="text-sm font-bold text-foreground">Tổng tiền cần chuyển</Text>
              <Text className="text-xs text-muted-foreground">
                {presentation.transferDescription}
              </Text>
              <Text selectable className="text-3xl font-extrabold text-primary">
                {formatVND(totalAmount)}
              </Text>
            </View>
          </Card>

          <PayeeAccount payment={payment} total={totalAmount} recipient={presentation.recipient} />

          {showReportForm && canReport ? (
            <PaymentProofForm
              recipient={presentation.recipient}
              proof={proof}
              onPick={(file) => void flow.select(file, payment.id)}
              onRefused={flow.reject}
              onPickFailed={toast.error}
              onPickingChange={flow.setPicking}
              onRemove={flow.remove}
              onCancel={() => setShowReportForm(false)}
              onSubmit={() => void reportTransfer()}
            />
          ) : null}
        </View>
      )}
    </ModalShell>
  );
}

function StatusBanner({
  status,
  icon,
  title,
  lines,
}: {
  status: string;
  icon: 'checkmark-circle' | 'time-outline' | 'ban-outline';
  title: string;
  lines: string[];
}) {
  const parts = toneParts(paymentStatus(status).tone);
  return (
    <View
      accessibilityLiveRegion="polite"
      className={`flex-row items-start gap-3 rounded-2xl border p-4 ${parts.box}`}>
      <Icon name={icon} size={22} className={parts.text} />
      <View className="flex-1 gap-1">
        <Text className={`text-base font-bold ${parts.text}`}>{title}</Text>
        {lines.filter(Boolean).map((line) => (
          <Text key={line} className="text-sm leading-6 text-foreground">
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

function CopyRow({
  label,
  value,
  copyLabel,
  onCopy,
  valueClass = 'text-base font-bold text-foreground',
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy: () => void;
  valueClass?: string;
}) {
  return (
    <View className="flex-row items-center gap-2 border-b border-border py-1.5">
      <View className="flex-1">
        <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
        <Text selectable className={valueClass}>
          {value}
        </Text>
      </View>
      <Pressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={copyLabel}
        className="h-11 w-11 items-center justify-center rounded-xl border border-border active:bg-muted">
        <Icon name="copy-outline" size={20} className="text-primary" />
      </Pressable>
    </View>
  );
}

/** Receiving account, VietQR and the copy buttons (web :635-795). */
function PayeeAccount({
  payment,
  total,
  recipient,
}: {
  payment: PaymentRequest;
  total: number;
  recipient: string;
}) {
  const toast = useToast();
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(false);
  const [saving, setSaving] = useState(false);
  const payee = payment.payeeBankAccountSnapshot || payment.payeeAccount;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!payee)
    return (
      <ToneBox tone="warning">
        <Text className="text-sm font-bold text-warning">
          Chưa có thông tin tài khoản nhận tiền.
        </Text>
        <Text className="text-xs leading-5 text-warning">
          Vui lòng liên hệ với {recipient} để kiểm tra thông tin tài khoản.
        </Text>
      </ToneBox>
    );

  async function copy(text: string, message: string) {
    await Clipboard.setStringAsync(text);
    if (mounted.current) toast.success(message);
  }
  const copyField = (text: string, label: string) => void copy(text, `Đã sao chép ${label}`);
  const copyAll = () =>
    void copy(
      [
        'THÔNG TIN CHUYỂN KHOẢN TRỰC TIẾP HOMESPACE',
        `Ngân hàng: ${payee.bankName} (${payee.bankCode})`,
        `Số tài khoản: ${payee.accountNumber}`,
        `Chủ tài khoản: ${payee.accountHolderName}`,
        `Số tiền: ${numberVi(total)} VND`,
        `Nội dung chuyển khoản: ${payment.transferReference}`,
      ].join('\n'),
      'Đã sao chép toàn bộ thông tin chuyển khoản!'
    );

  /** Web downloads the image; the phone's share sheet saves it or sends it to a banking app. */
  async function downloadQr() {
    const url = payment.qrImageUrl;
    setSaving(true);
    try {
      const name = `VietQR_${payment.transferReference.replace(/[^\w-]/g, '_')}.png`;
      const file = await writeRentalFile(name, 'VietQR.png', async (target) => {
        const result = await FileSystem.downloadAsync(url, target);
        if (result.status < 200 || result.status >= 300) throw new Error('download failed');
        return result.uri;
      });
      try {
        // No success message: a closed share sheet does not tell whether anything was saved.
        if (mounted.current)
          await shareRentalFile(file, () => Sharing.shareAsync(file, { mimeType: 'image/png' }));
      } finally {
        void discardRentalFile(file);
      }
    } catch {
      if (mounted.current) await openUrl(url).catch(() => {});
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  const showQr = Boolean(payment.qrImageUrl) && !qrError;
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Icon name="business-outline" size={18} className="text-primary" />
        <Text accessibilityRole="header" className="flex-1 text-sm font-bold text-foreground">
          Thông tin tài khoản nhận tiền
        </Text>
      </View>
      <ActionButton
        label="Sao chép toàn bộ"
        icon="copy-outline"
        variant="secondary"
        hint="Sao chép toàn bộ thông tin chuyển khoản"
        onClick={copyAll}
      />

      <View className="items-center gap-3">
        {showQr ? (
          // A QR needs a light backing in both themes: `logo` is white in both.
          <View className="rounded-3xl border border-border bg-logo p-3">
            <Image
              source={{ uri: payment.qrImageUrl }}
              accessibilityLabel="VietQR Chuyển khoản trực tiếp"
              resizeMode="contain"
              className="h-64 w-64"
              onLoad={() => setQrLoading(false)}
              onError={() => {
                setQrLoading(false);
                setQrError(true);
              }}
            />
            {qrLoading ? (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator size="large" className="text-brand" />
              </View>
            ) : null}
          </View>
        ) : (
          <View className="w-full items-center gap-2 rounded-2xl border border-dashed border-border bg-muted p-6">
            <Icon name="warning-outline" size={32} className="text-warning" />
            <Text className="text-center text-xs leading-5 text-muted-foreground">
              Không tải được mã QR. Vui lòng chuyển khoản thủ công theo thông tin bên cạnh.
            </Text>
          </View>
        )}
        {showQr ? (
          <ActionButton
            label="Tải mã QR"
            icon="download-outline"
            variant="secondary"
            busy={saving}
            onClick={() => void downloadQr()}
          />
        ) : null}
      </View>

      <View>
        <View className="border-b border-border py-1.5">
          <Text className="text-xs font-medium text-muted-foreground">Ngân hàng:</Text>
          <Text selectable className="text-base font-bold text-foreground">
            {payee.bankName} <Text className="text-primary">({payee.bankCode})</Text>
          </Text>
        </View>
        <CopyRow
          label="Số tài khoản:"
          value={payee.accountNumber}
          valueClass="font-mono text-xl font-bold text-foreground"
          copyLabel="Sao chép số tài khoản"
          onCopy={() => copyField(payee.accountNumber, 'số tài khoản')}
        />
        <CopyRow
          label="Chủ tài khoản:"
          value={payee.accountHolderName.toLocaleUpperCase('vi-VN')}
          copyLabel="Sao chép tên chủ tài khoản"
          onCopy={() => copyField(payee.accountHolderName, 'tên chủ tài khoản')}
        />
        <CopyRow
          label="Số tiền:"
          value={formatVND(total)}
          valueClass="text-xl font-extrabold text-primary"
          copyLabel="Sao chép số tiền"
          onCopy={() => copyField(String(total), 'số tiền')}
        />
        <CopyRow
          label="Nội dung CK:"
          value={payment.transferReference}
          valueClass="font-mono text-base font-bold text-primary"
          copyLabel="Sao chép nội dung chuyển khoản"
          onCopy={() => copyField(payment.transferReference, 'nội dung chuyển khoản')}
        />
      </View>

      <ToneBox tone="warning">
        <Text className="text-sm leading-6 text-warning">
          ⚠️ <Text className="font-bold">Lưu ý quan trọng:</Text> Vui lòng nhập đúng{' '}
          <Text className="font-bold">nội dung chuyển khoản ({payment.transferReference})</Text> để
          bên nhận dễ dàng kiểm tra và xác nhận nhanh chóng.
        </Text>
      </ToneBox>
    </Card>
  );
}
