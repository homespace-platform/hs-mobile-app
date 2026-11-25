// Web components/complaint/ComplaintPanel.tsx. The web <dialog> is a ModalShell.
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import Dropdown from '@/components/Dropdown';
import PdfViewerModal from '@/components/rental/pdf/PdfViewerModal';
import { useViewer } from '@/components/rental/requests/useViewer';
import ActionButton from '@/components/rental/shared/ActionButton';
import EvidencePicker from '@/components/rental/shared/EvidencePicker';
import ModalShell from '@/components/rental/shared/ModalShell';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { PERMISSIONS } from '@/lib/permissions';
import { useNotificationChangeSync, useVisiblePoll } from '@/lib/rental-sync/hooks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { vnDateTime } from '@/lib/rental/format';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { withFileLease } from '@/services/rental/cache';
import { complaintService } from '@/services/rental/complaint.service';
import { blobToCacheFile } from '@/services/rental/files';
import storageService from '@/services/rental/storage.service';
import type { LocalFile } from '@/services/storageApi';
import {
  complaintActions,
  complaintCategories,
  complaintStages,
  type ComplaintCase,
  type ComplaintCategory,
} from '@/types/rental/complaint.type';

import { ChoiceButton, openUrl } from '@/components/rental/onboarding/common';
import {
  Checkbox,
  LinkButton,
  Notice,
  TextArea,
  ToneBox,
  useActionLock,
  useAlive,
  useToast,
} from './common';
import ComplaintHistory, { type OpenProof, type ProofDocument } from './ComplaintHistory';
import {
  COMPLAINT_DRAFT_STALE,
  COMPLAINT_FILE_RULE,
  complaintDraftStale,
  complaintSendDisabled,
  complaintView,
  uploadAll,
  type ComplaintDraft,
} from './logic';

export type ComplaintPanelProps = {
  rentalRequestId: string;
  initialComplaintId?: string;
  attention?: boolean;
  onUpdated?: () => Promise<unknown> | void;
};

const actionHints: Record<string, string> = {
  COMMENT: 'Trao đổi với bên còn lại hoặc bổ sung chứng cứ cho hồ sơ này.',
  ESCALATE: 'Chuyển hồ sơ và chứng cứ hiện có để HomeSpace hỗ trợ xem xét.',
  CLOSE: 'Chỉ đóng khi vấn đề đã được giải quyết. Lịch sử và chứng cứ vẫn được giữ lại.',
  WITHDRAW: 'Ghi lý do rút hồ sơ. Lịch sử trao đổi vẫn được giữ lại.',
  REOPEN: 'Nêu thông tin mới hoặc lý do cần tiếp tục xử lý hồ sơ đã đóng.',
};
const date = (value?: string) => (value ? vnDateTime(value) : '—');
const PROOF_FAILED = 'Không mở được chứng cứ.';

const Body = ({ children, muted }: { children: React.ReactNode; muted?: boolean }) => (
  <Text className={`text-sm leading-6 ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
    {children}
  </Text>
);

/** Keyed by record: drafts and late answers never move to another request or complaint. */
export default function ComplaintPanel(props: ComplaintPanelProps) {
  const { userId } = useViewer();
  if (!userId || !props.rentalRequestId) return null;
  return (
    <Panel
      key={`${userId}:${props.rentalRequestId}:${props.initialComplaintId ?? ''}`}
      userId={userId}
      {...props}
    />
  );
}

function Panel({
  userId,
  rentalRequestId,
  initialComplaintId,
  attention = false,
  onUpdated,
}: ComplaintPanelProps & { userId: string }) {
  const createGate = useFeatureGate(PERMISSIONS.COMPLAINT_CREATE);
  const toast = useToast();
  const isAlive = useAlive();
  const lock = useActionLock();
  const [rows, setRows] = useState<ComplaintCase[]>([]);
  const [selected, setSelected] = useState(initialComplaintId ?? '');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('OTHER');
  const [urgent, setUrgent] = useState(false);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useDiscardDroppedFiles(files);
  const [creating, setCreating] = useState(false);
  const [chosenAction, setChosenAction] = useState('');
  const [draft, setDraft] = useState<ComplaintDraft | null>(null);
  const [modalOpen, setModalOpen] = useState(Boolean(initialComplaintId));
  const [pdf, setPdf] = useState<{ title: string; document: ProofDocument } | null>(null);
  const generation = useRef(0);
  const uploaded = useRef(new Map<string, string>());
  const editing = useRef(false);
  // Separate from `editing`: the picker's callbacks hold the values of the render that opened it.
  const pickerOpen = useRef(false);

  const [refresh] = useState(() => (automatic = false) => {
    const token = ++generation.current;
    return complaintService
      .list(rentalRequestId)
      .then((list) => {
        if (token !== generation.current || !isAlive()) return;
        // An automatic read never replaces the records while the user is writing.
        if (!automatic || (!editing.current && !pickerOpen.current)) setRows(list);
        setError('');
      })
      .catch((cause) => {
        if (token === generation.current && isAlive())
          setError(getApiErrorMessage(cause, 'Chưa tải được hồ sơ khiếu nại.'));
      })
      .finally(() => {
        if (token === generation.current && isAlive()) setLoading(false);
      });
  });
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useVisiblePoll(() => refresh(true), 20_000);
  useNotificationChangeSync(
    (event) => event.type === 'complaint-changed' && event.requestId === rentalRequestId,
    () => refresh(true)
  );

  const { scoped, current, actions, activeAction } = complaintView(
    rows,
    rentalRequestId,
    userId,
    selected,
    chosenAction
  );
  const actionLabel = (action: string) =>
    action === 'ESCALATE' && (current?.adminReviewCount ?? 0) > 0
      ? 'Yêu cầu admin xem xét lần 2'
      : complaintActions[action];

  // A draft stays on the record, revision and action it was started on, even when a reload changes
  // them: it is then locked until the user chooses an action again (stricter than web).
  const stale = !creating && complaintDraftStale(draft, current, activeAction);
  const formAction = stale ? draft!.action : activeAction;
  const pin = () => {
    if (creating || !current || !activeAction) return;
    if (!selected) setSelected(current.id);
    if (!draft) setDraft({ caseId: current.id, revision: current.revision, action: activeAction });
  };
  /** The user picked `action` on the record as it is shown now. */
  function chooseAction(action: string) {
    if (!current) return;
    setSelected(current.id);
    setDraft({ caseId: current.id, revision: current.revision, action });
    setChosenAction(action);
    // Only a reply carries files.
    if (action !== 'COMMENT') {
      editing.current = reason.trim().length > 0;
      setFiles([]);
    }
  }
  function clearDraft() {
    editing.current = false;
    setReason('');
    setFiles([]);
  }
  function resetDraft() {
    clearDraft();
    setChosenAction('');
    setDraft(null);
  }
  function close() {
    if (lock.held) return;
    setModalOpen(false);
    setCreating(false);
    resetDraft();
  }
  function openNew() {
    resetDraft();
    setCategory('OTHER');
    setUrgent(false);
    setCreating(true);
    setModalOpen(true);
  }

  async function proofs() {
    if (files.length > 5 || files.some((f) => f.sizeBytes <= 0 || f.sizeBytes > 15 * 1024 * 1024))
      throw new Error('Tối đa 5 chứng cứ, 15 MB/tệp.');
    return withFileLease(
      files.map((file) => file.uri),
      () =>
        uploadAll(files, uploaded.current, (file) =>
          storageService.uploadComplaintEvidence(file, rentalRequestId)
        )
    );
  }

  const sendDisabled = complaintSendDisabled({
    busy,
    picking,
    reason,
    creating,
    canCreate: createGate.allowed,
    activeAction,
    fileCount: files.length,
    stale,
  });

  function send() {
    if (!creating && activeAction !== 'COMMENT' && files.length) {
      toast.error('Gửi chứng cứ qua phản hồi trước khi thực hiện thao tác khác.');
      return;
    }
    if (sendDisabled) return;
    const action = creating ? 'OPEN' : activeAction!;
    if (!creating && (!current || !actions.includes(action))) return;
    const reviewed = current;
    const note = reason.trim();
    void lock.run(async () => {
      setBusy(true);
      try {
        const ids = creating || action === 'COMMENT' ? await proofs() : undefined;
        if (!isAlive()) return;
        if (creating) {
          const opened = await complaintService.open(rentalRequestId, {
            category,
            reason: note,
            evidenceIds: ids ?? [],
            urgent: urgent && ['SAFETY', 'HANDOVER'].includes(category),
          });
          if (isAlive()) setSelected(opened.id);
        } else
          await complaintService.act(reviewed!.id, action, {
            expectedRevision: reviewed!.revision,
            reason: note,
            evidenceIds: ids,
          });
        if (!isAlive()) return;
        resetDraft();
        setCreating(false);
        await refresh();
        if (!isAlive()) return;
        toast.success('Đã cập nhật hồ sơ khiếu nại.');
        try {
          await onUpdated?.();
        } catch {
          if (isAlive())
            toast.error(
              'Hồ sơ đã được lưu. Chưa làm mới được thông tin hợp đồng; vui lòng tải lại.'
            );
        }
      } catch (cause) {
        if (isAlive()) {
          toast.error(
            getApiErrorMessage(cause, 'Chưa thể gửi thao tác. Tải lại hồ sơ và kiểm tra phiên bản.')
          );
          await refresh();
        }
      } finally {
        if (isAlive()) setBusy(false);
      }
    });
  }

  // One session per record shown by the open sheet ('' when closed): a link answered after it ended
  // is dropped, also when the same record has been opened again.
  const viewing = modalOpen && !creating ? (current?.id ?? '') : '';
  const session = useRef(0);
  useEffect(() => {
    session.current += 1;
  }, [viewing]);

  const openProof: OpenProof = (id, label, document) => {
    // The signed final PDF is checked against the stored document before it is shown.
    if (document?.purpose === 'SIGNED_FINAL') {
      setPdf({ title: label, document });
      return;
    }
    const asked = session.current;
    const wanted = () => isAlive() && session.current === asked;
    void storageService
      .getViewUrl(id)
      .then((url) => (wanted() ? openUrl(url) : undefined))
      .catch((cause) => {
        if (wanted()) toast.error(getApiErrorMessage(cause, PROOF_FAILED));
      });
  };

  const openCount = scoped.filter((c) => c.status !== 'RESOLVED').length;
  const createLocked = busy || loading || !createGate.allowed;

  return (
    <View
      accessibilityLabel="Khiếu nại hồ sơ thuê"
      className="gap-3 rounded-2xl border border-primary-border bg-surface p-4">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          Khiếu nại & hỗ trợ từ HomeSpace
        </Text>
        <Body muted>Trao đổi với bên còn lại hoặc nhờ HomeSpace hỗ trợ.</Body>
        {attention ? (
          <Text className="text-sm leading-6 text-warning">Có vấn đề quyết toán cần trao đổi.</Text>
        ) : null}
        {!loading ? (
          <Body muted>
            {scoped.length ? `${openCount} đang mở · ${scoped.length} hồ sơ` : 'Chưa có khiếu nại.'}
          </Body>
        ) : null}
      </View>
      <ActionButton
        label={`Xem trao đổi${scoped.length ? ` (${scoped.length})` : ''}`}
        icon="chatbubbles-outline"
        variant="secondary"
        disabled={busy}
        onClick={() => {
          resetDraft();
          setCreating(false);
          setModalOpen(true);
        }}
      />
      <ActionButton
        label="Mở khiếu nại mới"
        icon="add"
        variant="secondary"
        disabled={createLocked}
        onClick={openNew}
      />
      {createGate.title ? <Body muted>{createGate.title}</Body> : null}
      {error && !modalOpen ? (
        <Text accessibilityRole="alert" className="text-sm text-danger">
          {error}
        </Text>
      ) : null}
      {modalOpen ? (
        <ModalShell
          title={creating ? 'Mở khiếu nại mới' : 'Khiếu nại & hỗ trợ'}
          closeLabel="Đóng cửa sổ khiếu nại"
          closeText="Đóng"
          closeDisabled={busy}
          onClose={close}>
          <View className="gap-4">
            <PolicyNotice
              tone="neutral"
              title="Hướng dẫn khiếu nại & hỗ trợ"
              summary="Gửi thông tin, đính kèm chứng cứ và chuyển HomeSpace khi cần.">
              <Notice>
                Gửi thông tin, đính kèm chứng cứ và chuyển HomeSpace khi cần. Thay đổi hợp đồng hoặc
                xử lý tiền thực hiện ở chức năng tương ứng.
              </Notice>
            </PolicyNotice>
            {error ? (
              <Text
                accessibilityRole="alert"
                className="rounded-xl border border-danger bg-danger-soft p-3 text-sm text-danger">
                {error}
              </Text>
            ) : null}
            <View className="flex-row flex-wrap gap-2">
              <ActionButton
                label="Tải lại"
                variant="secondary"
                icon="refresh"
                disabled={busy || loading}
                onClick={() => {
                  setLoading(true);
                  void refresh();
                }}
                className="grow"
              />
              {creating ? (
                <ActionButton
                  label="Xem hồ sơ đã có"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    resetDraft();
                    setCreating(false);
                  }}
                  className="grow"
                />
              ) : (
                <ActionButton
                  label="Mở khiếu nại mới"
                  variant="secondary"
                  disabled={createLocked}
                  onClick={openNew}
                  className="grow"
                />
              )}
            </View>
            {createGate.title ? <Body muted>{createGate.title}</Body> : null}
            {loading && !scoped.length && !creating ? <Body muted>Đang tải hồ sơ…</Body> : null}
            {!creating && scoped.length > 1 ? (
              <View accessibilityLabel="Chọn hồ sơ khiếu nại" className="gap-2">
                {scoped.map((c) => (
                  <ChoiceButton
                    key={c.id}
                    label={`${complaintCategories[c.category]} · ${date(c.openedAt)}`}
                    selected={current?.id === c.id}
                    disabled={busy}
                    onPress={() => {
                      resetDraft();
                      setSelected(c.id);
                    }}
                  />
                ))}
              </View>
            ) : null}
            {!creating && current ? (
              <>
                <CaseSummary complaint={current} userId={userId} onProof={openProof} />
                <ComplaintHistory complaint={current} expanded onProof={openProof} />
              </>
            ) : null}
            {creating ? (
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Vấn đề cần hỗ trợ</Text>
                <View className="flex-row">
                  <Dropdown
                    accessibilityLabel="Nhóm khiếu nại"
                    disabled={busy}
                    value={category}
                    onChange={(value) => {
                      if (busy) return;
                      setCategory(value as ComplaintCategory);
                      setUrgent(false);
                    }}
                    options={Object.entries(complaintCategories).map(([id, label]) => ({
                      id,
                      label,
                    }))}
                  />
                </View>
              </View>
            ) : null}
            {creating && category === 'DEPOSIT_SETTLEMENT' ? (
              <PolicyNotice
                tone="warning"
                title="Khiếu nại quyết toán cọc"
                summary="Hãy phản đối phiên bản tại mục quyết toán cọc trước.">
                <Notice>
                  Hãy phản đối phiên bản tại mục quyết toán cọc trước. Hồ sơ khiếu nại chỉ dùng để
                  trao đổi.
                </Notice>
              </PolicyNotice>
            ) : null}
            {creating && ['SAFETY', 'HANDOVER'].includes(category) ? (
              <Checkbox
                checked={urgent}
                onChange={setUrgent}
                disabled={busy}
                label="Chuyển HomeSpace ngay do sự cố an toàn / bàn giao."
              />
            ) : null}
            {creating || actions.length > 0 || stale ? (
              <View className="gap-3 border-t border-border pt-4">
                <Text className="text-sm font-bold text-foreground">
                  {creating
                    ? 'Mô tả vấn đề'
                    : formAction === 'COMMENT'
                      ? 'Gửi trao đổi'
                      : complaintActions[formAction!]}
                </Text>
                <TextArea
                  value={reason}
                  onChangeText={(value) => {
                    editing.current = value.trim().length > 0 || files.length > 0;
                    pin();
                    setReason(value);
                  }}
                  maxLength={500}
                  disabled={busy}
                  accessibilityLabel="Nội dung khiếu nại"
                  placeholder="Nhập nội dung từ 10 đến 500 ký tự"
                />
                {!creating && formAction !== 'COMMENT' ? (
                  <Body muted>{actionHints[formAction!]}</Body>
                ) : null}
                <Body muted>{reason.trim().length}/500 ký tự</Body>
                {creating || formAction === 'COMMENT' ? (
                  <EvidencePicker
                    // One draft per record and mode: a late pick cannot reach another one.
                    key={creating ? 'new' : (current?.id ?? '')}
                    label="Đính kèm chứng cứ · Tối đa 5 ảnh/PDF, 15 MB/tệp"
                    ariaLabel="Chứng cứ khiếu nại"
                    value={files}
                    onChange={(next) => {
                      editing.current = reason.trim().length > 0 || next.length > 0;
                      setFiles(next);
                    }}
                    onError={() => {
                      editing.current = reason.trim().length > 0;
                      setFiles([]);
                    }}
                    onPickingChange={(on) => {
                      pickerOpen.current = on;
                      if (on) pin();
                      setPicking(on);
                    }}
                    messages={COMPLAINT_FILE_RULE}
                    maxCount={5}
                    replace
                    camera
                    disabled={busy || stale}
                  />
                ) : null}
                <ActionButton
                  label={
                    busy
                      ? 'Đang gửi…'
                      : creating
                        ? 'Gửi khiếu nại'
                        : formAction === 'COMMENT'
                          ? 'Gửi trao đổi'
                          : actionLabel(formAction!)
                  }
                  disabled={sendDisabled}
                  onClick={send}
                />
                {stale ? (
                  <View className="gap-2">
                    <ToneBox tone="warning" alert>
                      {COMPLAINT_DRAFT_STALE}
                    </ToneBox>
                    {files.length > 0 && actions.some((a) => a !== 'COMMENT') ? (
                      <Body muted>Chọn thao tác không phải trao đổi sẽ gỡ tệp đính kèm.</Body>
                    ) : null}
                    {actions.map((a) => (
                      <ActionButton
                        key={a}
                        label={`Chọn lại: ${a === 'COMMENT' ? 'Gửi trao đổi' : actionLabel(a)}`}
                        variant="secondary"
                        disabled={busy || loading}
                        onClick={() => chooseAction(a)}
                      />
                    ))}
                  </View>
                ) : null}
                {!stale &&
                !creating &&
                activeAction !== 'COMMENT' &&
                actions.includes('COMMENT') ? (
                  <ActionButton
                    label="Quay lại trao đổi"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => chooseAction('COMMENT')}
                  />
                ) : null}
                {!stale && !creating && activeAction === 'COMMENT' ? (
                  <View className="flex-row flex-wrap gap-x-4">
                    {actions
                      .filter((a) => a !== 'COMMENT')
                      .map((a) => (
                        <LinkButton
                          key={a}
                          label={actionLabel(a)}
                          disabled={busy || files.length > 0}
                          onPress={() => chooseAction(a)}
                        />
                      ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            {!creating && !current && !loading && !error ? (
              <Text className="py-5 text-center text-sm leading-6 text-muted-foreground">
                {selected
                  ? 'Không tìm thấy hồ sơ được thông báo hoặc bạn không có quyền xem. Hệ thống không tự mở hồ sơ khác.'
                  : 'Chưa có hồ sơ khiếu nại. Chọn “Mở khiếu nại mới” để gửi thông tin.'}
              </Text>
            ) : null}
          </View>
          {pdf ? (
            // Inside the sheet (iOS). The viewer owns the downloaded file and deletes it on close.
            <PdfViewerModal
              isOpen
              onClose={() => setPdf(null)}
              title={pdf.title}
              documentKey={pdf.document.storageObjectId}
              loadingText="Đang xử lý…"
              errorText={PROOF_FAILED}
              source={async () => {
                try {
                  return await blobToCacheFile(
                    await complaintService.sourcePdf(pdf.document),
                    'pdf-can-cu.pdf'
                  );
                } catch (cause) {
                  throw new Error(getApiErrorMessage(cause, PROOF_FAILED), { cause });
                }
              }}
            />
          ) : null}
        </ModalShell>
      ) : null}
    </View>
  );
}

/** CP:109-119. */
function CaseSummary({
  complaint,
  userId,
  onProof,
}: {
  complaint: ComplaintCase;
  userId: string;
  onProof: OpenProof;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border p-3">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          {complaintCategories[complaint.category]}
        </Text>
        <Text className="text-sm font-semibold text-primary">
          {complaintStages[complaint.stage] ?? complaint.stage}
        </Text>
      </View>
      <Body>{complaint.reason}</Body>
      <Body muted>
        Admin đã kết luận {complaint.adminReviewCount ?? 0}/{complaint.adminReviewLimit ?? 2} lần.
      </Body>
      {complaint.finalClosed ? (
        <PolicyNotice
          tone="neutral"
          title="Hồ sơ đã đóng"
          summary="Admin đã kết luận lần 2 và đóng hồ sơ.">
          <Notice>
            Admin đã kết luận lần 2 và đóng hồ sơ. Bạn có thể xem lại toàn bộ lịch sử.
          </Notice>
        </PolicyNotice>
      ) : (complaint.adminReviewCount ?? 0) === 1 && complaint.status === 'OPEN' ? (
        <PolicyNotice
          tone="info"
          title="Quy trình xem xét khiếu nại"
          summary="Hai bên tiếp tục trao đổi; chưa giải quyết thì yêu cầu admin xem xét lần 2.">
          <Notice>
            Hai bên tiếp tục trao đổi. Nếu đã giải quyết, chọn đóng hồ sơ; nếu chưa, yêu cầu admin
            xem xét lần 2. Kết luận lần 2 sẽ kết thúc hồ sơ.
          </Notice>
        </PolicyNotice>
      ) : null}
      {complaint.respondBy ? (
        <Body muted>
          {complaint.responseDueFor === userId
            ? 'Bạn'
            : complaint.responseDueFor === 'ADMIN'
              ? 'HomeSpace'
              : 'Bên còn lại'}{' '}
          cần phản hồi trước {date(complaint.respondBy)}
          {complaint.overdue ? ' · Đã quá hạn' : ''}. Quá hạn không tự đồng ý hay xử lý tiền.
        </Body>
      ) : null}
      {complaint.evidenceIds.length ? (
        <View className="flex-row flex-wrap gap-x-4">
          {complaint.evidenceIds.map((id, index) => {
            const label = `Xem chứng cứ ${index + 1}`;
            return <LinkButton key={id} label={label} onPress={() => onProof(id, label)} />;
          })}
        </View>
      ) : null}
      {complaint.decision ? (
        <View className="gap-1 rounded-xl bg-primary-soft p-3">
          <Text className="text-sm font-bold text-foreground">
            Kết luận HomeSpace · Lần {complaint.adminReviewCount ?? 1}
          </Text>
          <Body>{complaint.decision}</Body>
        </View>
      ) : null}
      {complaint.status === 'RESOLVED' &&
      complaint.closingReason &&
      complaint.closingReason !== complaint.decision ? (
        <Body>Lý do đóng: {complaint.closingReason}</Body>
      ) : null}
    </View>
  );
}
