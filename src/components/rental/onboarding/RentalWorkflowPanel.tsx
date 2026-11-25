// Web: components/rental-request/RentalWorkflowPanel.tsx (cancellation and early exit).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import { Card } from '@/components/rental/shared/Card';
import DateField from '@/components/rental/shared/DateField';
import EvidencePicker from '@/components/rental/shared/EvidencePicker';
import FieldFrame from '@/components/rental/shared/FieldFrame';
import InfoRow from '@/components/rental/shared/InfoRow';
import ModalShell from '@/components/rental/shared/ModalShell';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { invoiceDetailPath } from '@/lib/rental/contract-routes';
import { calendarDate, date, keyOf, money } from '@/lib/rental/RentalWorkflowPanel';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { isAppVisible, useNotificationChangeSync } from '@/lib/rental-sync/hooks';
import { withFileLease } from '@/services/rental/cache';
import { rentalWorkflowService as service } from '@/services/rental/rental-workflow.service';
import storage from '@/services/rental/storage.service';
import type { LocalFile } from '@/services/storageApi';
import {
  workflowActions,
  workflowObligations,
  workflowStatuses,
  workflowTitles,
  type FinalRentCalculation,
  type RentalWorkflow,
  type WorkflowKind,
  type WorkflowProposal,
} from '@/types/rental/rental-workflow.type';

import { Checkbox, ChoiceButton, openUrl, ToneBox, useToast } from './common';
import {
  createCoalesced,
  performWorkflowAction,
  showsAckBox,
  workflowAckText,
  workflowActionBlocked,
  workflowActionLabel,
  workflowPrefilledReason,
} from './logic';
import RentalPaymentModal from './RentalPaymentModal';
import WorkflowDocumentsPanel from './WorkflowDocumentsPanel';

export type RentalWorkflowPanelProps = {
  rentalRequestId: string;
  kind: WorkflowKind;
  contractId?: string;
  focusRequest?: boolean;
  agreementId?: string;
  onUpdated?: () => Promise<unknown> | void;
  /** Mobile only: web link to the invoices of the contract. */
  onNavigate: RentalNavigate;
};

export default function RentalWorkflowPanel(props: RentalWorkflowPanelProps) {
  if (!props.rentalRequestId) return null;
  return <ScopedWorkflowPanel key={`${props.rentalRequestId}:${props.kind}`} {...props} />;
}

const body = 'text-sm leading-6 text-foreground';
const small = 'text-xs leading-5 text-foreground';
const FILE_MESSAGE = 'Tối đa 5 ảnh/PDF, 15 MB/tệp.';
const FILE_NAME = /[.](jpe?g|png|webp|pdf)$/i;

export function WorkflowSummary({
  proposal: p,
  lastOccupiedDay,
}: {
  proposal: WorkflowProposal;
  lastOccupiedDay?: string;
}) {
  return (
    <View className="gap-2">
      {p.reason ? <Text className={body}>{p.reason}</Text> : null}
      {p.endExclusive ? (
        <>
          <Text className={body}>
            {lastOccupiedDay ? 'Ngày ở cuối cùng: ' : 'Ngày kết thúc (không tính ngày này): '}
            <Text className="font-bold">
              {lastOccupiedDay ? calendarDate(lastOccupiedDay) : p.endExclusive}
            </Text>
          </Text>
          {p.handoverTerms ? <Text className={body}>Bàn giao: {p.handoverTerms}</Text> : null}
          <Text className={body}>
            {p.finalRentPolicy === 'DAILY_PRORATED'
              ? 'Tiền thuê kỳ cuối tính theo ngày thực tế của kỳ; các phí khác theo HĐ/hóa đơn.'
              : 'Tiền thuê và phí cố định tính trọn kỳ đã bắt đầu.'}{' '}
            Cọc quyết toán riêng sau hóa đơn cuối.
          </Text>
          {p.rentRefunds?.length ? (
            <View>
              <View className="flex-row justify-between gap-3 border-b border-border pb-1">
                <Text className="flex-1 text-xs font-bold text-foreground">
                  Khoản hoàn đã thống nhất
                </Text>
                <Text className="text-xs font-bold text-foreground">Số tiền</Text>
              </View>
              {p.rentRefunds.map((r, i) => (
                <InfoRow key={r.paymentId} label={`Khoản ${i + 1}`} value={money(r.amount)} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function RentCalculation({ value: q }: { value: FinalRentCalculation }) {
  return (
    <View className="gap-1 rounded-xl border border-border p-3">
      <Text className={small}>
        {q.usedDays}/{q.periodDays} ngày · Đơn giá tháng {money(q.monthlyRent)} · Tiền thuê kỳ cuối{' '}
        {money(q.agreedFinalRent)}
      </Text>
      <Text className={small}>
        Khoản hoàn thuê tối thiểu từ nguồn trả trước: {money(q.requiredRefund)}
      </Text>
      <Text className={small}>{q.explanation}</Text>
    </View>
  );
}

function Evidence({ ids }: { ids?: string[] }) {
  const toast = useToast();
  async function open(id: string) {
    try {
      await openUrl(await storage.getViewUrl(id));
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không mở được bằng chứng.'));
    }
  }
  if (!ids?.length) return null;
  return (
    <View className="flex-row flex-wrap gap-x-4">
      {ids.map((id, i) => (
        <Pressable
          key={id}
          onPress={() => void open(id)}
          accessibilityRole="link"
          className="min-h-11 justify-center">
          <Text className="text-sm font-semibold text-primary underline">
            Xem bằng chứng {i + 1} ↗
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ScopedWorkflowPanel({
  rentalRequestId,
  kind,
  contractId,
  focusRequest,
  agreementId,
  onUpdated,
  onNavigate,
}: RentalWorkflowPanelProps) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(!!focusRequest);
  const [data, setData] = useState<RentalWorkflow | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reason, setReason] = useState('');
  const [ack, setAck] = useState(false);
  const [contacted, setContacted] = useState(false);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [picking, setPicking] = useState(false);
  const [end, setEnd] = useState('');
  useDiscardDroppedFiles(files);
  const [paymentId, setPaymentId] = useState<string>();
  const [reviewedKey, setReviewedKey] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const mounted = useRef(true);
  const mutex = useRef(false);
  const uploaded = useRef(new Map<string, string>());
  const keyRef = useRef<string | null>(null);
  const focused = useRef(false);
  const scroll = useRef<ScrollView>(null);

  const needsReview = !busy && !!data && reviewedKey !== null && reviewedKey !== keyOf(data);
  const earlyExit = kind === 'early-exit';
  const choices = data?.terminationOptions?.choices ?? [];
  const selectedDate = choices.find((choice) => choice.endExclusive === end)?.lastOccupiedDay;
  const allowedDates = choices.map((choice) => choice.lastOccupiedDay);
  const proposalValid = !earlyExit || Boolean(selectedDate);

  // One GET at a time; callers arriving meanwhile share it and get one fresh follow-up (even after a
  // failed GET), so an older read cannot overwrite a newer one. In the background the follow-up waits.
  const hiddenDirty = useRef(false);
  const [refresh] = useState(() =>
    createCoalesced(
      async () => {
        try {
          const next = await service.get(rentalRequestId, kind);
          if (!mounted.current) return;
          const key = keyOf(next);
          const changed = keyRef.current !== null && keyRef.current !== key;
          keyRef.current = key;
          setData(next);
          setError('');
          setReviewedKey((previous) => previous ?? key);
          // Drafts survive a refresh; the acknowledgement only belongs to the reviewed revision.
          if (changed) {
            setAck(false);
            setContacted(false);
            setSelectedAction(null);
          }
        } catch (e) {
          if (mounted.current) setError(getApiErrorMessage(e, 'Chưa tải được hồ sơ.'));
        }
      },
      () => mounted.current,
      () => {
        if (isAppVisible()) return false;
        hiddenDirty.current = true;
        return true;
      }
    )
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !hiddenDirty.current) return;
      hiddenDirty.current = false;
      void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  // Only the revision/status the own action returned counts as reviewed.
  const acceptResult = (result?: RentalWorkflow) => {
    if (
      mounted.current &&
      typeof result?.revision === 'number' &&
      typeof result.status === 'string'
    )
      setReviewedKey(keyOf(result));
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (earlyExit || expanded) void refresh();
  }, [expanded, earlyExit, refresh]);
  const earlyExitContractId = data?.contractId ?? contractId;
  useNotificationChangeSync(
    (event) =>
      (event.type === 'agreement-changed' &&
        (!event.agreementId || event.agreementId === earlyExitContractId)) ||
      event.type === 'payment-changed',
    refresh,
    earlyExit && expanded
  );
  useEffect(() => {
    if (!focusRequest || focused.current) return;
    focused.current = true;
    setExpanded(true);
  }, [focusRequest]);

  const scrollToDocuments = useCallback((y: number) => {
    scroll.current?.scrollTo({ y, animated: true });
  }, []);

  function closeModal() {
    if (mutex.current) return;
    setExpanded(false);
    setCreating(false);
    setSelectedAction(null);
    setAck(false);
    setReason('');
    setFiles([]);
  }
  function chooseAction(action: string) {
    setSelectedAction(action);
    setAck(false);
    setFiles([]);
    setReason(workflowPrefilledReason(action));
  }
  function start() {
    if (!data) return;
    setSelectedAction(null);
    setReason('');
    setAck(false);
    setContacted(false);
    setFiles([]);
    setEnd(
      choices.some((choice) => choice.endExclusive === data.proposal.endExclusive)
        ? data.proposal.endExclusive!
        : ''
    );
    setCreating(true);
  }

  const input = { earlyExit, needsReview, reason, ack, contacted, proposalValid, picking };
  const perform = (action: string) =>
    withFileLease(
      files.map((file) => file.uri),
      () =>
        performWorkflowAction(
          action,
          { ...input, data, endExclusive: end, files },
          {
            lock: mutex,
            uploaded: uploaded.current,
            isAlive: () => mounted.current,
            setBusy,
            upload: (file) => storage.uploadComplaintEvidence(file, rentalRequestId),
            propose: (payload) => service.propose(rentalRequestId, kind, payload),
            act: (name, payload) => service.act(rentalRequestId, kind, name, payload),
            onSaved: () => {
              setReason('');
              setFiles([]);
              setCreating(false);
              setSelectedAction(null);
              setAck(false);
            },
            refresh,
            accept: acceptResult,
            onUpdated,
            notify: toast,
          }
        )
    );

  const otherActions = data?.allowedActions.filter((action) => action !== 'PROPOSE') ?? [];
  const showConfirm = Boolean(
    data &&
    (creating ||
      (earlyExit
        ? selectedAction && data.allowedActions.includes(selectedAction)
        : otherActions.length))
  );
  const confirmActions = creating
    ? ['PROPOSE']
    : earlyExit && selectedAction
      ? [selectedAction]
      : otherActions;

  const content: ReactNode = (
    <View className="gap-3">
      {kind === 'cancellation' ? (
        <PolicyNotice
          tone="neutral"
          title="Đề nghị hủy và hoàn tiền"
          summary="Dùng khi đã nhận tiền nhưng chưa hoàn tất HĐ thuê.">
          <Text className="text-sm leading-6 text-secondary">
            Dùng khi đã nhận tiền nhưng chưa hoàn tất HĐ thuê. Đề nghị này hoàn toàn bộ khoản thực
            nhận; không tự mất cọc. Nếu HĐ cọc đã đủ chữ ký (và HĐ thuê chưa đủ chữ ký), tiền cọc
            không được hoàn, chỉ hoàn tiền thuê tháng đầu nếu đã nhận. HĐ thuê đã đủ chữ ký thì cần
            dùng chấm dứt hợp đồng. Nếu không phản hồi, chủ nhà chỉ kết thúc sau hạn, đã liên hệ
            khách và phòng chưa bàn giao. Chữ ký/chứng từ chưa rõ phải đối soát trước.
          </Text>
        </PolicyNotice>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger">
          {error}
        </Text>
      ) : null}
      {!data && !error ? <Text className={body}>Đang tải…</Text> : null}
      {data ? (
        <>
          {needsReview ? (
            <ToneBox tone="info" alert>
              <PolicyNotice
                title="Hồ sơ đã được cập nhật"
                summary="Nội dung hồ sơ đã được cập nhật.">
                <Text className="text-sm leading-6 text-secondary">
                  Nội dung hồ sơ đã được cập nhật. Phần bạn đang nhập vẫn được giữ lại; hãy đọc nội
                  dung mới và xác nhận đã xem trước khi thao tác.
                </Text>
              </PolicyNotice>
              <ActionButton
                label="Tôi đã xem nội dung mới"
                variant="secondary"
                onClick={() => setReviewedKey(keyOf(data))}
              />
            </ToneBox>
          ) : null}
          <Text className="text-sm font-semibold text-foreground">
            {workflowStatuses[data.status] ?? data.status}
          </Text>
          <Text className={small}>
            {workflowObligations[data.depositObligation] ?? 'Nghĩa vụ đang được theo dõi'}
          </Text>
          {data.blockedReason ? <ToneBox tone="warning">{data.blockedReason}</ToneBox> : null}
          {earlyExit && data.terminationOptions ? (
            <Text className={small}>
              Mốc kết thúc hiện đang áp dụng:{' '}
              <Text className="font-bold">
                {calendarDate(data.terminationOptions.currentEndExclusive)}
              </Text>{' '}
              lúc 00:00 (không gồm ngày này).
            </Text>
          ) : null}
          {earlyExit && data.status === 'APPROVED' ? (
            <PolicyNotice
              title="Phụ lục chấm dứt sớm"
              summary="Chủ nhà đã đồng ý và hệ thống đã tạo phụ lục Word/PDF.">
              <Text className="text-sm leading-6 text-secondary">
                Chủ nhà đã đồng ý và hệ thống đã tạo phụ lục Word/PDF. Hãy đọc văn bản bên dưới; chủ
                nhà ký trước, người thuê ký sau. Chưa đủ hai chữ ký hợp lệ thì ngày kết thúc hiện
                tại vẫn giữ nguyên.
              </Text>
            </PolicyNotice>
          ) : null}
          {data.respondBy ? (
            <PolicyNotice
              tone="neutral"
              title="Hạn phản hồi"
              summary="Quá hạn không tự xác nhận đồng ý hoặc nhận tiền.">
              <Text className="text-sm leading-6 text-secondary">
                Hạn phản hồi: {date(data.respondBy)}. Quá hạn không tự xác nhận đồng ý hoặc nhận
                tiền.
              </Text>
            </PolicyNotice>
          ) : null}
          {/* While composing, the newest saved record is shown read-only only when it needs review. */}
          {(!creating || needsReview) && (!earlyExit || data.revision > 0) ? (
            <View
              accessibilityLabel={creating ? 'Nội dung mới nhất đã lưu (chỉ đọc)' : undefined}
              className={
                creating ? 'gap-2 rounded-xl border border-dashed border-border p-3' : 'gap-3'
              }>
              {creating ? (
                <Text className="text-xs font-semibold text-foreground">
                  Nội dung mới nhất đã lưu (chỉ đọc) — bản nháp bạn đang nhập nằm riêng bên dưới.
                </Text>
              ) : null}
              <WorkflowSummary
                proposal={data.proposal}
                lastOccupiedDay={data.terminationOptions?.proposedLastOccupiedDay}
              />
              <Evidence ids={data.proposal.evidenceIds} />
              <Text className={small}>
                Chủ nhà xác nhận: {date(data.ownerConfirmedAt)} · Người thuê xác nhận:{' '}
                {date(data.tenantConfirmedAt)}
              </Text>
              {data.rentCalculation &&
              (data.rentCalculation.policy === 'DAILY_PRORATED' ||
                data.rentCalculation.requiredRefund > 0) ? (
                <RentCalculation value={data.rentCalculation} />
              ) : null}
            </View>
          ) : null}
          <View className="gap-2">
            {data.allowedActions.includes('PROPOSE') && !creating ? (
              <ActionButton
                label={
                  earlyExit
                    ? data.revision > 0
                      ? 'Soạn đề nghị điều chỉnh'
                      : 'Lập đề nghị chấm dứt sớm'
                    : workflowActions.PROPOSE
                }
                disabled={busy}
                onClick={start}
              />
            ) : null}
            <ActionButton
              label="Tải lại nội dung"
              icon="refresh"
              variant="secondary"
              disabled={busy}
              onClick={() => void refresh()}
            />
            {creating ? (
              <ActionButton
                label="Quay lại hồ sơ"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setCreating(false);
                  setFiles([]);
                  setAck(false);
                }}
              />
            ) : null}
          </View>
          {creating && earlyExit ? (
            <View className="gap-3 rounded-xl border border-border p-3">
              <Text className="text-sm font-semibold text-foreground">Chọn ngày ở cuối cùng</Text>
              <PolicyNotice
                tone="neutral"
                title="Chọn ngày ở cuối cùng"
                summary="Chỉ chọn ngày cuối kỳ thuê được hệ thống cho phép, trước khi hết hạn hợp đồng.">
                <Text className="text-sm leading-6 text-secondary">
                  Chỉ chọn ngày cuối kỳ thuê được hệ thống cho phép, trước khi hết hạn hợp đồng. Chủ
                  nhà từ chối thì ngày kết thúc hiện tại được giữ nguyên.
                </Text>
              </PolicyNotice>
              {choices.length ? (
                <>
                  <DateField
                    ariaLabel="Chọn ngày ở cuối cùng"
                    value={selectedDate ?? ''}
                    min={allowedDates[0]}
                    max={allowedDates[allowedDates.length - 1]}
                    isDateDisabled={(key) => !allowedDates.includes(key)}
                    onlyAvailable
                    disabled={busy}
                    onChange={(key) => {
                      const choice = choices.find((value) => value.lastOccupiedDay === key);
                      if (!choice) return;
                      setEnd(choice.endExclusive);
                      setAck(false);
                    }}
                  />
                  <Text className={body}>
                    {selectedDate
                      ? `Ngày ở cuối cùng: ${calendarDate(selectedDate)}`
                      : 'Chọn ngày được tô nổi bật trên lịch.'}
                  </Text>
                </>
              ) : (
                <View accessibilityLiveRegion="polite" className="rounded-xl bg-muted p-3">
                  <Text className={small}>
                    Không còn ngày cuối kỳ hợp lệ để chấm dứt sớm. Hãy tải lại hồ sơ nếu thông tin
                    vừa thay đổi.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
          {creating && !earlyExit ? (
            <EvidencePicker
              label="Ảnh / PDF bằng chứng (tối đa 5, 15 MB/tệp)"
              value={files}
              maxCount={5}
              replace
              onPickingChange={setPicking}
              messages={FILE_MESSAGE}
              namePattern={FILE_NAME}
              disabled={busy}
              onChange={(next) => {
                setFiles(next);
                setAck(false);
              }}
              onError={(message) => {
                toast.error(message);
                // As on web, a refused selection clears what was chosen.
                if (message === FILE_MESSAGE) setFiles([]);
                setAck(false);
              }}
            />
          ) : null}
          {earlyExit && !creating && otherActions.length ? (
            <View accessibilityLabel="Chọn phản hồi đề nghị" className="gap-2">
              {otherActions.map((action) => (
                <ChoiceButton
                  key={action}
                  label={workflowActionLabel(action, earlyExit)}
                  selected={selectedAction === action}
                  disabled={busy || needsReview}
                  onPress={() => chooseAction(action)}
                />
              ))}
            </View>
          ) : null}
          {showConfirm ? (
            <View
              accessibilityLabel="Xác nhận thao tác thỏa thuận"
              className="gap-3 rounded-xl border border-border p-3">
              {earlyExit ? (
                <>
                  <Text
                    accessibilityRole="header"
                    className="text-base font-semibold text-foreground">
                    {creating
                      ? 'Gửi đề nghị chấm dứt sớm'
                      : workflowActionLabel(selectedAction!, earlyExit)}
                  </Text>
                  {selectedAction === 'ACCEPT' && !creating ? (
                    <PolicyNotice
                      tone="neutral"
                      title="Đồng ý đề nghị chấm dứt sớm"
                      summary="Đồng ý sẽ tự tạo phụ lục Word/PDF để hai bên ký số.">
                      <Text className="text-sm leading-6 text-secondary">
                        Đồng ý sẽ tự tạo phụ lục Word/PDF để hai bên ký số. Đây chưa phải chữ ký số
                        SmartCA và chưa xác nhận bàn giao hay nhận tiền.
                      </Text>
                    </PolicyNotice>
                  ) : null}
                  {selectedAction === 'CANCEL' ? (
                    <PolicyNotice
                      tone="neutral"
                      title="Hủy đề nghị đang chờ ký"
                      summary="Hủy đề nghị đang chờ ký.">
                      <Text className="text-sm leading-6 text-secondary">
                        Hủy đề nghị đang chờ ký. Chữ ký đã hoàn tất của một bên vẫn được lưu để đối
                        chiếu, nhưng không còn hiệu lực áp dụng hạn thuê mới.
                      </Text>
                    </PolicyNotice>
                  ) : null}
                </>
              ) : null}
              <FieldFrame label={creating ? 'Lý do lập / chỉnh đề xuất' : 'Nội dung phản hồi'}>
                <TextInput
                  value={reason}
                  onChangeText={(text) => {
                    setReason(text);
                    setAck(false);
                  }}
                  editable={!busy}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                  accessibilityLabel="Nội dung thao tác"
                  className="min-h-24 rounded-xl border border-border bg-background p-3 text-base text-foreground selection:text-primary placeholder:text-subtle"
                />
              </FieldFrame>
              {showsAckBox(earlyExit, creating, selectedAction) ? (
                <Checkbox
                  checked={ack}
                  disabled={busy || needsReview}
                  onChange={setAck}
                  label={workflowAckText(data, kind, creating, selectedAction)}
                />
              ) : null}
              {data.allowedActions.includes('FULL_REFUND_EXIT') && !creating ? (
                <Checkbox
                  checked={contacted}
                  disabled={busy}
                  onChange={setContacted}
                  label="Tôi đã liên hệ người thuê về đề nghị này; phòng chưa bàn giao và tôi đồng ý hoàn toàn bộ khoản thực nhận."
                />
              ) : null}
              {confirmActions.map((action) => (
                <ActionButton
                  key={action}
                  label={
                    creating
                      ? earlyExit
                        ? 'Gửi đề nghị cho chủ nhà'
                        : 'Gửi đề xuất để hai bên kiểm tra'
                      : earlyExit
                        ? 'Xác nhận thao tác'
                        : (workflowActions[action] ?? action)
                  }
                  variant="secondary"
                  busy={busy}
                  disabled={workflowActionBlocked(action, creating, input)}
                  onClick={() => void perform(action)}
                />
              ))}
              {earlyExit && !creating ? (
                <ActionButton
                  label="Hủy thao tác"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setSelectedAction(null);
                    setAck(false);
                    setReason('');
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {earlyExit && data.contractId && ['AGREED', 'RETURNED'].includes(data.status) ? (
            <ActionButton
              label="Mở hồ sơ thanh toán & quyết toán →"
              link
              onClick={() => {
                const target = invoiceDetailPath(data.contractId!);
                closeModal();
                onNavigate(target);
              }}
            />
          ) : null}
          {data.complaintId ? (
            <Text className={small}>
              Đã liên kết khiếu nại. Tiếp tục phản hồi và chuyển HomeSpace tại mục Khiếu nại & hỗ
              trợ.
            </Text>
          ) : null}
          {kind !== 'cancellation' && data.revision > 0 && !creating ? (
            <WorkflowDocumentsPanel
              rentalRequestId={rentalRequestId}
              kind={kind}
              data={data}
              agreementId={agreementId}
              onFocusRequest={scrollToDocuments}
              onUpdated={async () => {
                await refresh();
                await onUpdated?.();
              }}
            />
          ) : null}
          {data.refundPayments.length ? (
            <View className="gap-2">
              {data.refundPayments.map((p, i) => (
                <View key={p.id} className="gap-2 rounded-xl border border-border p-3">
                  <Text className={body}>
                    Khoản hoàn {i + 1}: {money(p.totalAmount)} ·{' '}
                    {p.status === 'CONFIRMED' ? 'Đã xác nhận thực nhận' : 'Chưa hoàn tất xác nhận'}
                  </Text>
                  <ActionButton
                    label="Mở thanh toán / đối soát"
                    variant="secondary"
                    onClick={() => setPaymentId(p.id)}
                  />
                </View>
              ))}
            </View>
          ) : null}
          {data.history.length ? (
            <Accordion title={`Lịch sử và các bản đã đối chiếu (${data.history.length})`}>
              <View className="gap-3">
                {[...data.history].reverse().map((e) => (
                  <View key={e.revision} className="gap-2 border-t border-border pt-3">
                    <Text className="text-xs font-semibold text-foreground">
                      {workflowActions[e.action] ?? e.action} ·{' '}
                      {e.role === 'LANDLORD' ? 'Chủ nhà' : 'Người thuê'} · {date(e.at)}
                    </Text>
                    <Text className={body}>{e.reason}</Text>
                    <WorkflowSummary proposal={e.proposal} />
                    <Evidence ids={e.evidenceIds} />
                  </View>
                ))}
              </View>
            </Accordion>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const paymentModal = paymentId ? (
    <RentalPaymentModal
      request={{ id: rentalRequestId }}
      paymentId={paymentId}
      isOpen
      onClose={() => {
        setPaymentId(undefined);
        void refresh();
      }}
      onPaymentSuccess={() => {
        setPaymentId(undefined);
        void refresh();
      }}
    />
  ) : null;
  const frame = focusRequest ? 'border-2 border-primary' : '';

  if (!earlyExit)
    return (
      <View accessibilityLabel={workflowTitles[kind]}>
        <Accordion
          title={workflowTitles[kind]}
          open={expanded}
          onToggle={setExpanded}
          plusMinus
          className={frame}>
          {content}
        </Accordion>
        {paymentModal}
      </View>
    );

  return (
    <Card className={`gap-3 ${frame}`}>
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-semibold text-foreground">
          {workflowTitles[kind]}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {data
            ? (workflowStatuses[data.status] ?? data.status)
            : error
              ? 'Chưa tải được hồ sơ'
              : 'Đang tải hồ sơ…'}
        </Text>
      </View>
      <ActionButton
        label="Xem / đề nghị chấm dứt sớm"
        variant="secondary"
        onClick={() => setExpanded(true)}
      />
      {expanded ? (
        <ModalShell
          title={workflowTitles[kind]}
          onClose={closeModal}
          closeText="Đóng"
          closeLabel="Đóng cửa sổ chấm dứt sớm"
          closeDisabled={busy}
          scrollRef={scroll}>
          {content}
          {/* Inside the sheet: a second Modal beside it would not show on iOS. */}
          {paymentModal}
        </ModalShell>
      ) : null}
    </Card>
  );
}
