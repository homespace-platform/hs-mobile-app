// Web: components/contract/detail/ContractLifecyclePanel.tsx with mode="renewal" (LP line numbers
// below). The settlement mode belongs to billing/.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import Icon from '@/components/Icon';
import { parseDays } from '@/components/rental/billing/logic';
import { useToast } from '@/components/rental/onboarding/common';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import ActionButton from '@/components/rental/shared/ActionButton';
import FieldFrame, { inputBoxClass, inputTextClass } from '@/components/rental/shared/FieldFrame';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { useNotificationChangeSync } from '@/lib/rental-sync/hooks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import { dt, renewalLabels } from '@/lib/rental/ContractLifecyclePanel';
import { contractLifecycleService as api } from '@/services/rental/contract-lifecycle.service';
import type { ContractLifecycle, ContractRenewal } from '@/types/rental/contract-lifecycle.type';

import { linkText, NoticeText } from './fields';

export type ContractRenewalPanelProps = {
  contractId: string;
  isLandlord: boolean;
  onUpdated?: () => Promise<void>;
  /** Mobile only: web link to the renewal agreement. */
  onNavigate: RentalNavigate;
};

function Milestone({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-sm font-bold text-foreground">{value}</Text>
    </View>
  );
}

const muted = 'text-sm leading-6 text-muted-foreground';

export default function ContractRenewalPanel({
  contractId,
  isLandlord,
  onUpdated,
  onNavigate,
}: ContractRenewalPanelProps) {
  const toast = useToast();
  const { confirm } = useActionDialog();
  const [data, setData] = useState<ContractLifecycle | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mutex = useRef(false);
  const alive = useRef(false);
  const inflight = useRef<Promise<void> | null>(null);
  const dirty = useRef(false);
  const parent = useRef(onUpdated);
  useEffect(() => {
    parent.current = onUpdated;
  });
  const [months, setMonths] = useState('3');
  const [note, setNote] = useState('');

  // LP:68-86: one read at a time, and one more if asked while reading.
  const refresh = useCallback((): Promise<void> => {
    if (!alive.current) return Promise.resolve();
    if (inflight.current) {
      dirty.current = true;
      return inflight.current;
    }
    const run = (async () => {
      try {
        do {
          dirty.current = false;
          try {
            const next = await api.get(contractId);
            if (!alive.current) return;
            setData(next);
            setError('');
            await parent.current?.();
          } catch (e) {
            if (alive.current) setError(getApiErrorMessage(e, 'Chưa tải được vòng đời hợp đồng.'));
          }
        } while (dirty.current && alive.current);
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [contractId]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  // LP:89-91
  useNotificationChangeSync(
    (event) =>
      event.type === 'payment-changed' ||
      (event.type === 'invoice-changed' &&
        (!event.contractId || event.contractId === contractId)) ||
      (event.type === 'agreement-changed' &&
        (!event.agreementId ||
          event.agreementId === contractId ||
          !!data?.renewals.some((r) => r.agreementContractId === event.agreementId))),
    refresh
  );

  // LP:92-98
  async function perform(action: () => Promise<unknown>) {
    if (mutex.current) return;
    mutex.current = true;
    setBusy(true);
    try {
      await action();
      if (!alive.current) return;
      await refresh();
      if (alive.current) toast.success('Đã cập nhật hồ sơ hợp đồng.');
    } catch (e) {
      if (alive.current) toast.error(getApiErrorMessage(e, 'Thao tác chưa thành công.'));
    } finally {
      mutex.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function requestRenewal() {
    // The whole text, read as web's number field reads it: a paste is never cut into another number.
    const count = parseDays(months);
    if (!Number.isInteger(count) || count < 1 || count > 36 || note.trim().length < 10) {
      toast.error('Chọn 1–36 tháng và nhập lý do ít nhất 10 ký tự.');
      return;
    }
    void perform(() => api.request(contractId, count, note.trim()));
  }
  async function approve(r: ContractRenewal) {
    if (
      await confirm({
        title: 'Duyệt yêu cầu gia hạn thời gian thuê?',
        description:
          'Hệ thống tạo văn bản gia hạn giữ nguyên giá và chính sách. Hợp đồng chưa kéo dài cho đến khi ký đủ hai bên.',
        confirmLabel: 'Duyệt & tạo văn bản',
      })
    )
      void perform(() => api.decide(contractId, r.id, true));
  }

  return (
    <View className="gap-4 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="calendar-outline" size={20} className="text-primary" />
        <Text accessibilityRole="header" className="flex-1 text-base font-bold text-foreground">
          Gia hạn thời gian thuê
        </Text>
        <Pressable
          onPress={() => void refresh()}
          accessibilityRole="button"
          accessibilityLabel="Làm mới vòng đời hợp đồng"
          className="h-11 w-11 items-center justify-center rounded-lg border border-border">
          <Icon name="refresh" size={18} className="text-foreground" />
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm leading-6 text-danger">
          {error}
        </Text>
      ) : null}
      {!data && !error ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator className="text-primary" />
          <Text className={muted}>Đang tải…</Text>
        </View>
      ) : null}
      {data ? (
        <>
          <View className="gap-3 rounded-xl bg-primary-soft p-3">
            <Milestone
              label="Mốc hết thời hạn thuê"
              value={`${data.endExclusive} · 00:00 (không bao gồm ngày này)`}
            />
            <Milestone label="Mở yêu cầu trước 30 ngày" value={dt(data.renewalOpensAt)} />
            <Milestone label="Hạn ký đủ văn bản gia hạn" value={dt(data.renewalSignBy)} />
          </View>
          <PolicyNotice
            tone="neutral"
            title="Gia hạn thời gian thuê"
            summary="Kéo dài thời hạn thuê, khác với dời hạn thanh toán; chỉ áp dụng sau đủ chữ ký SmartCA.">
            <NoticeText>
              Gia hạn thời gian thuê (kéo dài hợp đồng) khác dời hạn thanh toán của một hóa đơn. Giữ
              nguyên giá/chính sách và cọc, tạo văn bản mới liên kết bản gốc; chỉ áp dụng sau đủ chữ
              ký SmartCA. Hạn ký trước ngày chốt công tơ kỳ cuối để không thiếu tiền thuê kỳ tiếp
              theo.
            </NoticeText>
          </PolicyNotice>
          {!isLandlord && !data.canRequestRenewal && !data.closure ? (
            <View className="gap-2 rounded-xl border border-border p-3">
              <ActionButton label="Gia hạn thời gian thuê" variant="secondary" disabled />
              <Text className={muted}>
                {new Date(data.serverNow) < new Date(data.renewalOpensAt)
                  ? `Mở yêu cầu từ ${dt(data.renewalOpensAt)} (30 ngày trước khi hết hạn).`
                  : new Date(data.serverNow) >= new Date(data.renewalSignBy)
                    ? 'Đã hết thời gian yêu cầu/ký gia hạn; tiếp tục thanh toán chi phí kỳ cuối và bàn giao.'
                    : 'Chưa thể gửi yêu cầu mới. Kiểm tra hồ sơ gia hạn hoặc phương án chấm dứt đang xử lý bên dưới.'}
              </Text>
            </View>
          ) : null}
          {!isLandlord && data.canRequestRenewal ? (
            <View className="gap-3 rounded-xl border border-border p-3">
              {data.renewals.some(
                (r) =>
                  r.startsOn === data.endExclusive && ['REJECTED', 'EXPIRED'].includes(r.status)
              ) ? (
                <Text className={muted}>
                  Đề nghị trước đã bị từ chối hoặc hết hạn. Bạn có thể gửi đề nghị mới trong thời
                  gian cho phép; lịch sử trước đó được giữ nguyên.
                </Text>
              ) : null}
              <Text className="text-sm font-bold text-foreground">
                Gửi yêu cầu gia hạn thời gian thuê
              </Text>
              <FieldFrame label="Số tháng thêm">
                <View className={inputBoxClass(false)}>
                  <TextInput
                    value={months}
                    onChangeText={setMonths}
                    // No maxLength: it would cut a pasted value into a different, valid one.
                    keyboardType="number-pad"
                    accessibilityLabel="Số tháng gia hạn thuê"
                    className={inputTextClass()}
                  />
                </View>
              </FieldFrame>
              <View className={inputBoxClass(false)}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                  placeholder="Nhu cầu tiếp tục thuê (ít nhất 10 ký tự)"
                  accessibilityLabel="Lý do gia hạn thuê"
                  className={`min-h-24 ${inputTextClass()}`}
                />
              </View>
              <ActionButton label="Gửi yêu cầu gia hạn" busy={busy} onClick={requestRenewal} />
            </View>
          ) : null}
          {data.renewals.map((r) => {
            const childId = r.agreementContractId;
            return (
              <View key={r.id} className="gap-2 rounded-xl border border-border p-3">
                <Text className="text-sm font-bold text-foreground">
                  Thêm {r.months} tháng · {renewalLabels[r.status]}
                </Text>
                <Text className="text-sm leading-6 text-foreground">
                  Từ {r.startsOn} đến trước {r.endExclusive}. Hạn duyệt: {dt(r.respondBy)} · Hạn ký:{' '}
                  {dt(r.signBy)}
                </Text>
                <Text className={muted}>{r.note}</Text>
                {r.decidedAt ? (
                  <Text className={muted}>Chủ nhà phản hồi lúc {dt(r.decidedAt)}</Text>
                ) : null}
                {isLandlord && r.status === 'REQUESTED' ? (
                  <View className="flex-row flex-wrap gap-2">
                    <ActionButton
                      label="Duyệt & tạo văn bản"
                      disabled={busy}
                      onClick={() => void approve(r)}
                      className="grow"
                    />
                    <ActionButton
                      label="Từ chối"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void perform(() => api.decide(contractId, r.id, false))}
                      className="grow"
                    />
                  </View>
                ) : null}
                {childId &&
                (isLandlord ||
                  r.agreementStatus === 'TENANT_SIGNATURE_PENDING' ||
                  r.agreementStatus === 'ACTIVE') ? (
                  <Pressable
                    onPress={() =>
                      onNavigate(contractDetailPath(isLandlord ? 'landlord' : 'tenant', childId))
                    }
                    accessibilityRole="link"
                    className="min-h-11 justify-center self-start">
                    <Text className={linkText}>Mở văn bản gia hạn · xem PDF & ký SmartCA ↗</Text>
                  </Pressable>
                ) : null}
                {!isLandlord &&
                r.status === 'APPROVED' &&
                r.agreementStatus !== 'TENANT_SIGNATURE_PENDING' ? (
                  <Text className={muted}>
                    Chờ chủ nhà kết xuất PDF và ký trước; sau đó bạn sẽ ký trên văn bản đã có chữ ký
                    chủ nhà.
                  </Text>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}
