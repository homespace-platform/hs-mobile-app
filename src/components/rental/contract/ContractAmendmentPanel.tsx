// Web: components/contract/detail/ContractAmendmentPanel.tsx (AP). As on the web, nothing is signed
// here: an agreed addendum is signed on its own contract page, which the card links to.
// AmendmentActionBar is the web's floating bar; the screen footer mounts it for the page workspace.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import Icon from '@/components/Icon';
import { useOpenStorage } from '@/components/rental/billing/common';
import { Checkbox, useToast } from '@/components/rental/onboarding/common';
import Accordion from '@/components/rental/shared/Accordion';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import EvidencePicker from '@/components/rental/shared/EvidencePicker';
import FieldFrame, { inputBoxClass, inputTextClass } from '@/components/rental/shared/FieldFrame';
import ModalShell from '@/components/rental/shared/ModalShell';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import { labels } from '@/lib/rental/ContractAmendmentPanel';
import {
  amendmentDate as date,
  amendmentTime as time,
} from '@/lib/rental/ContractAmendmentWorkspace';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { withFileLease } from '@/services/rental/cache';
import { contractAmendmentService as api } from '@/services/rental/contract-amendment.service';
import storageService from '@/services/rental/storage.service';
import type { LocalFile } from '@/services/storageApi';
import type {
  AmendmentComparison,
  AmendmentPayload,
  AmendmentProposal,
} from '@/types/rental/contract-amendment.type';

import AmendmentComparisonTable from './AmendmentComparisonTable';
import AmendmentEffectiveDatePicker from './AmendmentEffectiveDatePicker';
import {
  canAnswerProposal,
  canResumeDraft,
  collectEvidence,
  invalidAmendmentField,
  panelLists,
  replacesSigned,
  signingTurn,
} from './amendmentLogic';
import { Anchor, useAnchors } from './anchors';
import ContractAmendmentWorkspace, { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { linkText, NoticeText } from './fields';
import ListingSyncControl from './ListingSyncControl';

export type ContractAmendmentPanelProps = {
  contractId: string;
  actorId: string;
  perspective: DashboardRole;
  agreementId?: string;
  /** Mobile only: web link "Mở phụ lục" to the signing document. */
  onNavigate: RentalNavigate;
};

const JUMPS = [
  ['residents', 'Thông tin các bên'],
  ['property', 'Tài sản thuê'],
  ['lease', 'Bàn giao'],
  ['rent', 'Giá thuê'],
  ['amenities', 'Tiện ích'],
  ['charges', 'Phí dịch vụ'],
  ['equipments', 'Nội thất'],
  ['rules', 'Nội quy'],
] as const;

/** Web `accept="image/jpeg,image/png,image/webp,application/pdf"`; size is checked on upload. */
const EVIDENCE_PICK = {
  maxCount: 5,
  replace: true,
  maxBytes: 15 * 1024 * 1024,
  messages: {
    type: 'Minh chứng cần là ảnh JPG/PNG/WebP hoặc PDF, tối đa 15 MB/tệp.',
    size: 'Minh chứng cần là ảnh JPG/PNG/WebP hoặc PDF, tối đa 15 MB/tệp.',
    count: 'Tối đa 5 minh chứng.',
  },
};

const REPLACE_LABELS = {
  beforeLabel: 'Phụ lục đã ký trước đó',
  afterLabel: 'Nội dung bản thay thế',
};
const CONSENT_SEND = 'Tôi đã kiểm tra đúng nội dung và ngày áp dụng trước khi gửi cho người thuê.';
const CONSENT_APPROVE =
  'Tôi đã đọc và đồng ý với đúng nội dung đề xuất này. Phụ lục chỉ áp dụng sau khi ký đủ và đến ngày hiệu lực.';
const REVIEW_DESCRIPTION =
  'Chỉ hiển thị nội dung thay đổi. Đồng ý nội dung chưa thay thế việc ký số.';

function useEvidenceUpload(contractId: string) {
  const uploaded = useRef(new Map<LocalFile, string>());
  return (files: LocalFile[], old: string[] = []) =>
    withFileLease(
      files.map((file) => file.uri),
      () =>
        collectEvidence(files, old, uploaded.current, (file) =>
          storageService.uploadAmendmentEvidence(file, contractId)
        )
    );
}

function Area({
  label,
  value,
  onChange,
  maxLength = 2000,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <FieldFrame label={label}>
      <View className={inputBoxClass(false, disabled)}>
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          multiline
          maxLength={maxLength}
          placeholder={placeholder}
          textAlignVertical="top"
          accessibilityLabel={label}
          className={`min-h-24 ${inputTextClass(disabled)}`}
        />
      </View>
    </FieldFrame>
  );
}

function Evidence({ ids }: { ids: string[] }) {
  // Closing the dialog or leaving unmounts this list, so a late answer is dropped.
  const openStorage = useOpenStorage();
  const opening = useRef(false);
  const shown = useRef(ids);
  useEffect(() => {
    shown.current = ids;
  });
  const open = async (id: string) => {
    if (opening.current) return;
    opening.current = true;
    try {
      await openStorage(id, 'Không mở được minh chứng.', () => shown.current.includes(id));
    } finally {
      opening.current = false;
    }
  };
  if (!ids.length) return null;
  return (
    <View className="flex-row flex-wrap gap-x-4">
      {ids.map((id, i) => (
        <Pressable
          key={id}
          onPress={() => void open(id)}
          accessibilityRole="link"
          className="min-h-11 justify-center">
          <Text className="text-sm text-primary underline">Minh chứng {i + 1} ↗</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Banner({ children }: { children: string }) {
  return (
    <View className="rounded-xl border border-primary-border bg-primary-soft p-3">
      <Text className="text-sm leading-6 text-foreground">{children}</Text>
    </View>
  );
}
const applyNote = (when: string) =>
  `${when}. Giữ nguyên hóa đơn đã phát hành và giao dịch ban đầu. Cọc tăng/giảm tạo khoản chênh lệch riêng sau ngày hiệu lực; cần bên nhận xác nhận nhận tiền.`;

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return open;
}

type Review = { payload: AmendmentPayload; comparison: AmendmentComparison[] };

/** AP:69-82,140: "Hủy / Lưu nháp / Xem lại thay đổi" and the dialog that sends the proposal. */
export function AmendmentActionBar({ inline = false }: { inline?: boolean }) {
  const w = useAmendmentWorkspace();
  const toast = useToast();
  const anchors = useAnchors();
  const { confirm } = useActionDialog();
  const [review, setReview] = useState<Review | null>(null);
  // Consent belongs to the preview that was read, never to a later one.
  const [consented, setConsented] = useState<Review | null>(null);
  const evidence = useEvidenceUpload(w?.contractId ?? '');
  const keyboardOpen = useKeyboardOpen();
  if (!w?.editing || !w.data) return null;
  const { contractId, data } = w;
  const consent = review !== null && consented === review;

  const preview = () => {
    const invalid = invalidAmendmentField(w.values);
    if (invalid) anchors?.scrollTo(invalid);
    void w.run(async () => {
      const payload = w.payload();
      const result = await api.preview(contractId, payload);
      setReview({ payload, comparison: result.comparison });
    });
  };
  const submit = () =>
    w.run(async () => {
      if (!review || !consent) return;
      w.setData(
        await api.propose(contractId, {
          ...review.payload,
          evidenceIds: await evidence(w.files, w.evidenceIds),
        })
      );
      w.stop();
      w.setSavedDraft(null);
      setReview(null);
      toast.success('Đã gửi đề xuất cho người thuê. Điều khoản hiện tại chưa thay đổi.');
    });
  const save = () =>
    w.run(async () => {
      const ids = await evidence(w.files, w.evidenceIds);
      const payload = { ...w.payload(false), evidenceIds: ids };
      w.setSavedDraft(await api.saveDraft(contractId, payload));
      w.setEvidenceIds(ids);
      w.setFiles([]);
      toast.success('Đã lưu bản nháp riêng. Chưa gửi cho người thuê.');
    });
  const cancel = async () => {
    if (
      await confirm({
        title: 'Đóng chỉnh sửa?',
        description: 'Thay đổi chưa lưu sẽ bị bỏ; bản nháp đã lưu vẫn giữ lại.',
        tone: 'warning',
      })
    ) {
      setReview(null);
      w.stop();
    }
  };

  return (
    <>
      {/* Hidden, not unmounted, while typing: a running listing sync must not be aborted. */}
      <View
        accessibilityLabel="Thao tác lưu phụ lục"
        className={
          inline
            ? 'gap-2 rounded-xl border border-border bg-surface p-3'
            : keyboardOpen
              ? 'hidden'
              : 'gap-2 border-t border-border bg-surface px-4 pb-3 pt-3'
        }>
        <Text accessibilityLiveRegion="polite" className="text-xs font-semibold text-foreground">
          {w.changedGroupCount} nhóm nội dung đã chỉnh
        </Text>
        <ListingSyncControl
          contractId={contractId}
          baseRevisionId={data.currentTermsRevisionId}
          disabled={w.busy || w.editingFinancial}
          onSelect={(source, notice) => {
            w.selectListingSync(source);
            toast.success(
              [notice, 'Đã cập nhật dữ liệu vào phụ lục đang soạn.'].filter(Boolean).join('\n\n')
            );
          }}
        />
        {w.listingSourceVersion ? (
          <ActionButton
            label="Bỏ bản bài đăng đã chọn"
            variant="secondary"
            disabled={w.busy}
            onClick={() => w.selectListingSync(null)}
          />
        ) : null}
        <View className="flex-row gap-2">
          <ActionButton
            label="Hủy"
            variant="secondary"
            disabled={w.busy}
            onClick={() => void cancel()}
          />
          <ActionButton
            label="Lưu nháp"
            variant="secondary"
            disabled={w.busy}
            onClick={() => void save()}
          />
          <ActionButton
            label={w.busy ? 'Đang xử lý…' : 'Xem lại thay đổi'}
            busy={w.busy}
            disabled={!w.hasChanges}
            onClick={preview}
            className="flex-1"
          />
        </View>
      </View>
      {/* Outside the bar: a modal must not sit in a hidden view. */}
      {review ? (
        <ModalShell
          title="Kiểm tra thay đổi trước khi gửi"
          closeLabel="Đóng cửa sổ"
          closeDisabled={w.busy}
          onClose={() => setReview(null)}
          footer={
            <>
              <ActionButton
                label="Quay lại chỉnh sửa"
                variant="secondary"
                disabled={w.busy}
                onClick={() => setReview(null)}
                className="grow"
              />
              <ActionButton
                label="Gửi đề xuất cho người thuê"
                busy={w.busy}
                disabled={!consent}
                onClick={() => void submit()}
                className="grow"
              />
            </>
          }>
          <View className="gap-4">
            <Text className="text-sm leading-6 text-muted-foreground">{REVIEW_DESCRIPTION}</Text>
            <Banner>
              {applyNote(`Dự kiến áp dụng ${date(review.payload.effectiveOn ?? '')}`)}
            </Banner>
            <AmendmentComparisonTable
              rows={review.comparison}
              {...(w.replacement ? REPLACE_LABELS : {})}
            />
            <Text className="text-sm leading-6 text-foreground">
              Lý do: {review.payload.reason}
            </Text>
            <Checkbox
              checked={consent}
              disabled={w.busy}
              onChange={(checked) => setConsented(checked ? review : null)}
              label={CONSENT_SEND}
            />
          </View>
        </ModalShell>
      ) : null}
    </>
  );
}

export default function ContractAmendmentPanel(props: ContractAmendmentPanelProps) {
  const workspace = useAmendmentWorkspace();
  return workspace?.contractId === props.contractId ? (
    <Panel {...props} />
  ) : (
    <ContractAmendmentWorkspace
      contractId={props.contractId}
      actorId={props.actorId}
      perspective={props.perspective}>
      {/* The screen footer only reaches the page workspace, so this one draws its own bar. */}
      <Panel {...props} ownWorkspace />
    </ContractAmendmentWorkspace>
  );
}

function Panel({
  agreementId,
  onNavigate,
  ownWorkspace,
}: ContractAmendmentPanelProps & { ownWorkspace?: boolean }) {
  const w = useAmendmentWorkspace()!;
  const toast = useToast();
  const anchors = useAnchors();
  const { confirm } = useActionDialog();
  const [requestOpen, setRequestOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [requestFiles, setRequestFiles] = useState<LocalFile[]>([]);
  const [requestToken, setRequestToken] = useState('');
  const [view, setView] = useState<AmendmentProposal | null>(null);
  // Consent belongs to the exact proposal content that was opened.
  const [consented, setConsented] = useState<AmendmentProposal | null>(null);
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const evidence = useEvidenceUpload(w.contractId);
  useDiscardDroppedFiles(requestFiles);
  const { data, contractId, actorId, perspective, editing } = w;
  const isOwner = perspective === 'landlord';

  // AW:119: bring the composer into view (the page switches to the content tab by itself).
  useEffect(() => {
    if (editing) anchors?.scrollWhenDrawn('contract-amendment-actions');
  }, [editing, anchors]);

  if (w.error)
    return (
      <View className="gap-2 rounded-2xl border border-border bg-surface p-4">
        <Text accessibilityRole="alert" className="text-sm leading-6 text-foreground">
          {w.error}
        </Text>
        <ActionButton label="Tải lại phụ lục" variant="secondary" onClick={() => void w.load()} />
        {ownWorkspace ? <AmendmentActionBar inline /> : null}
      </View>
    );
  if (!data)
    return (
      <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-surface p-4">
        <ActivityIndicator className="text-primary" />
        <Text className="text-sm text-muted-foreground">Đang tải phụ lục…</Text>
      </View>
    );

  const { current, shown, history } = panelLists(data.proposals, agreementId);
  const canAnswer = canAnswerProposal(view, data.proposals, actorId);
  const consent = view !== null && consented === view;

  const decide = (
    p: AmendmentProposal,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'WITHDRAW' | 'CANCEL'
  ) =>
    w.run(async () => {
      if (['REJECT', 'REQUEST_CHANGES'].includes(action) && note.trim().length < 10)
        throw new Error('Ghi rõ lý do hoặc nội dung cần sửa (ít nhất 10 ký tự).');
      w.setData(await api.decide(contractId, p.id, action, note));
      setView(null);
      setNote('');
      setConsented(null);
      toast.success(
        action === 'APPROVE'
          ? 'Đã đồng ý nội dung. Chủ nhà ký trước, sau đó người thuê ký.'
          : 'Đã lưu phản hồi.'
      );
    });
  const negotiation = (p: AmendmentProposal, action: 'ACCEPT' | 'REJECT') =>
    w.run(async () => {
      if (action === 'REJECT' && note.trim().length < 10)
        throw new Error('Ghi rõ lý do từ chối (ít nhất 10 ký tự).');
      w.setData(await api.decideNegotiation(contractId, p.id, action, note));
      setNote('');
      if (action === 'ACCEPT') {
        w.start(undefined, null, { ...p, status: 'TENANT_ACCEPTED' });
        toast.success('Đã chấp thuận trao đổi. Hãy soạn nội dung trên hợp đồng bên dưới.');
      } else toast.success('Đã từ chối yêu cầu. Điều khoản giữ nguyên.');
    });
  const sendRequest = () =>
    w.run(async () => {
      if (message.trim().length < 10) throw new Error('Nội dung yêu cầu cần ít nhất 10 ký tự.');
      w.setData(
        await api.requestNegotiation(contractId, {
          requestId: requestToken,
          message: message.trim(),
          evidenceIds: await evidence(requestFiles),
        })
      );
      setRequestOpen(false);
      setMessage('');
      setRequestFiles([]);
      toast.success('Đã gửi mong muốn cho chủ nhà. Chưa thay đổi điều khoản hợp đồng.');
    });
  const openView = (p: AmendmentProposal) => {
    setView(p);
    setConsented(null);
    setNote('');
  };
  const discardDraft = async () => {
    if (
      await confirm({
        title: 'Xóa bản nháp riêng?',
        description: 'Nội dung hợp đồng không thay đổi.',
        tone: 'danger',
      })
    )
      void w.run(async () => {
        await api.discardDraft(contractId);
        w.setSavedDraft(null);
      });
  };
  const withdraw = async (p: AmendmentProposal) => {
    if (
      await confirm({
        title: 'Rút đề xuất này?',
        description: 'Điều khoản hiện tại sẽ được giữ nguyên.',
        tone: 'danger',
      })
    )
      void decide(p, 'WITHDRAW');
  };
  const cancelSigning = async (p: AmendmentProposal) => {
    if (
      await confirm({
        title: 'Hủy phụ lục đang chờ ký?',
        description:
          'Chữ ký đã hoàn tất của một bên được lưu để đối chiếu; điều khoản hiện tại giữ nguyên.',
        tone: 'danger',
      })
    )
      void decide(p, 'CANCEL');
  };
  const dangerLink = (label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={w.busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: w.busy }}
      className={`min-h-11 justify-center self-start ${w.busy ? 'opacity-50' : ''}`}>
      <Text className="text-sm font-semibold text-danger">{label}</Text>
    </Pressable>
  );

  const body = (p: AmendmentProposal) => {
    if (p.status.startsWith('TENANT_'))
      return (
        <>
          {['TENANT_REQUESTED', 'TENANT_ACCEPTED'].includes(p.status) ? (
            <PolicyNotice
              tone="neutral"
              title="Hạn xử lý yêu cầu điều chỉnh"
              summary="Không xử lý thì đóng yêu cầu; không tự chấp thuận.">
              <NoticeText>
                {p.status === 'TENANT_REQUESTED'
                  ? 'Hạn chủ nhà phản hồi'
                  : 'Hạn soạn và gửi đề xuất'}
                : {time(p.respondBy)}. Không xử lý thì đóng yêu cầu; không tự chấp thuận.
              </NoticeText>
            </PolicyNotice>
          ) : null}
          {isOwner && p.status === 'TENANT_REQUESTED' ? (
            <View className="gap-3">
              <ActionButton
                label="Chấp thuận trao đổi · Soạn phụ lục"
                disabled={w.busy || editing}
                onClick={() => void negotiation(p, 'ACCEPT')}
              />
              <Area label="Lý do từ chối yêu cầu" value={note} onChange={setNote} />
              <ActionButton
                label="Từ chối yêu cầu"
                variant="warning"
                disabled={w.busy || note.trim().length < 10}
                onClick={() => void negotiation(p, 'REJECT')}
              />
            </View>
          ) : null}
          {isOwner && p.status === 'TENANT_ACCEPTED' && !editing ? (
            <ActionButton
              label="Soạn phụ lục trên hợp đồng"
              disabled={w.busy}
              onClick={() =>
                w.start(undefined, w.savedDraft?.tenantRequestId === p.id ? w.savedDraft : null, p)
              }
            />
          ) : null}
          {!isOwner && p.status === 'TENANT_ACCEPTED' ? (
            <PolicyNotice
              tone="info"
              title="Trạng thái đề nghị điều chỉnh"
              summary="Chủ nhà đã chấp thuận trao đổi, chưa chấp thuận điều khoản cụ thể.">
              <NoticeText>
                Chủ nhà đã chấp thuận trao đổi, chưa chấp thuận điều khoản cụ thể. Bạn sẽ nhận bản
                đối chiếu để duyệt trước khi ký.
              </NoticeText>
            </PolicyNotice>
          ) : null}
        </>
      );
    const turn = signingTurn(p.agreementStatus, isOwner);
    const childId = p.agreementContractId;
    return (
      <View className="gap-3">
        <Pressable
          onPress={() => openView(p)}
          accessibilityRole="button"
          className="min-h-11 justify-center self-start">
          <Text className="text-sm font-bold text-primary">Xem nội dung đề xuất →</Text>
        </Pressable>
        {p.status === 'REQUESTED' ? (
          <Text className="text-xs leading-5 text-muted-foreground">
            {p.recipientId === actorId ? 'Bạn cần phản hồi' : 'Chờ người thuê phản hồi'} trước{' '}
            {time(p.respondBy)}.
          </Text>
        ) : null}
        {p.status === 'CHANGES_REQUESTED' && isOwner && p.proposerId === actorId && !editing ? (
          <ActionButton
            label="Chỉnh lại trên hợp đồng"
            disabled={w.busy}
            onClick={() => w.start(p)}
          />
        ) : null}
        {p.status === 'APPROVED' && childId ? (
          <View className="gap-1 rounded-xl border border-primary-border bg-primary-soft p-3">
            <Text className="text-sm leading-6 text-foreground">{turn.message}</Text>
            <Text className="text-xs leading-5 text-muted-foreground">
              Hạn ký: {time(p.signBy)}. Chưa ký đủ thì điều khoản cũ vẫn áp dụng.
            </Text>
            <Pressable
              onPress={() => onNavigate(contractDetailPath(perspective, childId))}
              accessibilityRole="link"
              className="min-h-11 justify-center self-start">
              <Text className={linkText}>{turn.link} →</Text>
            </Pressable>
          </View>
        ) : null}
        {p.status === 'SCHEDULED' ? (
          <View className="gap-2">
            <Text className="text-sm leading-6 text-success">
              Đã đủ chữ ký. Điều khoản mới áp dụng từ {date(p.effectiveOn)}.
            </Text>
            {isOwner && p.canReplace && !editing ? (
              <ActionButton
                label="Chỉnh lại phụ lục"
                disabled={w.busy}
                onClick={() =>
                  w.start(p, w.savedDraft?.previousProposalId === p.id ? w.savedDraft : null)
                }
              />
            ) : null}
            {isOwner && !p.canReplace && p.replacementBlockedReason ? (
              <Text className="text-xs leading-5 text-muted-foreground">
                {p.replacementBlockedReason}
              </Text>
            ) : null}
          </View>
        ) : null}
        {p.proposerId === actorId && ['REQUESTED', 'CHANGES_REQUESTED'].includes(p.status)
          ? dangerLink('Rút đề xuất', () => void withdraw(p))
          : null}
        {p.status === 'APPROVED'
          ? dangerLink('Hủy phụ lục chờ ký', () => void cancelSigning(p))
          : null}
      </View>
    );
  };

  const card = (p: AmendmentProposal) => (
    <View key={p.id} className="gap-3 rounded-xl border border-border bg-background p-4">
      <View className="gap-1">
        <Text className="text-sm font-bold text-foreground">{labels[p.status]}</Text>
        <Text className="text-xs leading-5 text-muted-foreground">
          {p.status.startsWith('TENANT_')
            ? 'Yêu cầu bằng chữ của người thuê'
            : `${p.comparison.length} nội dung thay đổi`}{' '}
          · {time(p.submittedAt)}
        </Text>
        {p.status.startsWith('TENANT_') ? null : (
          <Badge tone="info">
            {p.immediateEffect ? 'Áp dụng sau khi ký đủ' : `Từ ${date(p.effectiveOn)}`}
          </Badge>
        )}
      </View>
      <Text selectable className="text-sm leading-6 text-foreground">
        {p.reason}
      </Text>
      {p.responseNote ? (
        <View className="rounded-lg bg-muted p-3">
          <Text className="text-sm leading-6 text-foreground">Phản hồi: {p.responseNote}</Text>
        </View>
      ) : null}
      <Evidence ids={p.evidenceIds} />
      {body(p)}
    </View>
  );

  return (
    <Anchor id="contract-amendment-actions">
      <View className="gap-4 rounded-2xl border border-border bg-surface p-4">
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Icon name="create-outline" size={20} className="text-primary" />
              <Text
                accessibilityRole="header"
                className="flex-1 text-base font-bold text-foreground">
                Phụ lục & điều chỉnh
              </Text>
            </View>
            <Text className="mt-1 text-sm leading-6 text-muted-foreground">
              {isOwner
                ? 'Chỉnh tại từng mục hợp đồng, đối chiếu rồi gửi người thuê duyệt.'
                : 'Gửi mong muốn hoặc xem và phản hồi đề xuất của chủ nhà.'}
            </Text>
          </View>
          <Pressable
            onPress={() => void w.load()}
            disabled={w.busy || editing}
            accessibilityRole="button"
            accessibilityLabel="Làm mới phụ lục"
            accessibilityState={{ disabled: w.busy || editing }}
            className={`h-11 w-11 items-center justify-center rounded-lg border border-border ${w.busy || editing ? 'opacity-40' : ''}`}>
            <Icon name="refresh" size={18} className="text-foreground" />
          </Pressable>
        </View>

        {!agreementId && !editing ? (
          <View className="gap-2">
            {isOwner && w.savedDraft && canResumeDraft(w.savedDraft, current) ? (
              <ActionButton
                label="Tiếp tục bản nháp"
                variant="secondary"
                disabled={w.busy}
                onClick={() => w.start(undefined, w.savedDraft)}
              />
            ) : null}
            {isOwner && w.savedDraft ? (
              <ActionButton
                label="Xóa bản nháp"
                variant="secondary"
                disabled={w.busy}
                onClick={() => void discardDraft()}
              />
            ) : null}
            <ActionButton
              label={isOwner ? 'Điều chỉnh hợp đồng' : 'Đề nghị điều chỉnh'}
              disabled={!data.canPropose || w.busy}
              onClick={() => {
                if (isOwner) w.start();
                else {
                  setRequestToken(randomUUID());
                  setRequestOpen(true);
                }
              }}
            />
            {!data.canPropose && data.blockedReason ? (
              <Text className="text-xs leading-5 text-muted-foreground">{data.blockedReason}</Text>
            ) : null}
          </View>
        ) : null}

        {editing ? (
          <View className="gap-4 rounded-xl border border-primary-border bg-primary-soft p-3">
            <Text className="text-sm font-bold text-foreground">
              Đang soạn phụ lục · Nội dung chưa có hiệu lực
            </Text>
            <PolicyNotice
              tone="neutral"
              title="Hướng dẫn soạn phụ lục"
              actionLabel="Xem hướng dẫn"
              summary="Điều chỉnh giá, cọc hoặc phí cần hai bên duyệt và ký.">
              <NoticeText>
                Dùng bản bài đăng đã duyệt để cập nhật tài sản, tiện ích, nội thất và nội quy. Nhập
                các thỏa thuận riêng trực tiếp trên hợp đồng. Điều chỉnh giá, cọc hoặc phí cần hai
                bên duyệt và ký.
              </NoticeText>
            </PolicyNotice>
            <View accessibilityLabel="Đi tới mục điều chỉnh" className="flex-row flex-wrap gap-2">
              {JUMPS.map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => anchors?.scrollTo(`amendment-${key}`)}
                  accessibilityRole="link"
                  className="min-h-11 justify-center rounded-full border border-border bg-surface px-3">
                  <Text className="text-xs font-semibold text-primary">{label}</Text>
                </Pressable>
              ))}
            </View>
            <View className="gap-3 rounded-xl bg-surface p-3">
              <AmendmentEffectiveDatePicker
                availableDates={w.replacement ? [w.replacement.effectiveOn] : data.availableDates}
                value={w.effectiveOn}
                onChange={w.setEffectiveOn}
                disabled={w.busy}
              />
              <Text className="text-xs leading-5 text-muted-foreground">
                {w.financial
                  ? 'Giá/phí mới dùng từ đầu kỳ tương lai. Chi phí kỳ trước theo đơn giá cũ; không sửa hóa đơn đã phát hành.'
                  : 'Nội dung không ảnh hưởng tiền cũng áp dụng từ đầu kỳ thuê tương lai, không áp dụng ngay.'}
              </Text>
              <Area
                label="Lý do và mô tả thay đổi"
                value={w.reason}
                onChange={w.setReason}
                disabled={w.busy}
              />
              <EvidencePicker
                {...EVIDENCE_PICK}
                label="Minh chứng bổ sung (tối đa 5 tệp)"
                value={w.files}
                onChange={w.setFiles}
                existingCount={w.evidenceIds.length}
                disabled={w.busy}
              />
              <Evidence ids={w.evidenceIds} />
            </View>
          </View>
        ) : null}

        {editing ? (
          w.editingFinancial ? (
            <View className="gap-1">
              <Text className="text-sm font-bold text-foreground">
                Đang soạn thỏa thuận tài chính riêng
              </Text>
              <Pressable
                onPress={async () => {
                  if (
                    !(await confirm({
                      title: 'Bỏ phần chỉnh sửa giá, cọc và phí của đề xuất này?',
                      tone: 'warning',
                    }))
                  )
                    return;
                  w.patch('financial', structuredClone(data.currentTerms.financial));
                  w.patch('charges', structuredClone(data.currentTerms.charges));
                  w.setEditingFinancial(false);
                }}
                disabled={w.busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: w.busy }}
                className={`min-h-11 justify-center self-start ${w.busy ? 'opacity-50' : ''}`}>
                <Text className={linkText}>Bỏ chỉnh sửa tài chính</Text>
              </Pressable>
            </View>
          ) : (
            <ActionButton
              label="Soạn thỏa thuận tài chính"
              variant="secondary"
              disabled={w.busy || Boolean(w.listingSourceVersion)}
              onClick={() => w.setEditingFinancial(true)}
            />
          )
        ) : null}

        {editing && w.replacement ? (
          <PolicyNotice
            tone="warning"
            title="Chỉnh lại phụ lục chưa áp dụng"
            summary="Bản ký cũ vẫn giữ nguyên lịch áp dụng cho đến khi hai bên ký đủ bản thay thế.">
            <NoticeText>
              Đang chỉnh lại phụ lục chưa áp dụng, giữ ngày hiệu lực{' '}
              {date(w.replacement.effectiveOn)}. Bản ký cũ vẫn giữ nguyên lịch áp dụng cho đến khi
              người thuê duyệt và hai bên ký đủ bản thay thế. Hủy thao tác hoặc bản mới không hoàn
              tất không làm mất bản cũ.
            </NoticeText>
          </PolicyNotice>
        ) : null}

        {shown.map(card)}
        {history.length > 0 && !agreementId ? (
          <Accordion title={`Lịch sử yêu cầu và phụ lục (${history.length})`}>
            <View className="gap-3">{history.map(card)}</View>
          </Accordion>
        ) : null}
        {ownWorkspace ? <AmendmentActionBar inline /> : null}
      </View>

      {view ? (
        <ModalShell
          title="Đề xuất điều chỉnh hợp đồng"
          closeLabel="Đóng cửa sổ"
          closeDisabled={w.busy}
          onClose={() => setView(null)}
          footer={
            canAnswer ? (
              <>
                <ActionButton
                  label="Từ chối"
                  variant="warning"
                  disabled={w.busy || note.trim().length < 10}
                  onClick={() => void decide(view, 'REJECT')}
                  className="grow"
                />
                <ActionButton
                  label="Yêu cầu chỉnh lại"
                  variant="secondary"
                  disabled={w.busy || note.trim().length < 10}
                  onClick={() => void decide(view, 'REQUEST_CHANGES')}
                  className="grow"
                />
                <ActionButton
                  label="Đồng ý nội dung"
                  disabled={w.busy || !consent}
                  onClick={() => void decide(view, 'APPROVE')}
                  className="w-full"
                />
              </>
            ) : (
              <ActionButton
                label="Đóng"
                variant="secondary"
                disabled={w.busy}
                onClick={() => setView(null)}
                className="grow"
              />
            )
          }>
          <View className="gap-4">
            <Text className="text-sm leading-6 text-muted-foreground">{REVIEW_DESCRIPTION}</Text>
            <Banner>
              {applyNote(
                view.immediateEffect
                  ? 'Áp dụng sau khi hai bên ký đủ'
                  : `Dự kiến áp dụng ${date(view.effectiveOn ?? '')}`
              )}
            </Banner>
            <AmendmentComparisonTable
              rows={view.comparison}
              {...(w.replacement || replacesSigned(data.proposals, view.previousProposalId)
                ? REPLACE_LABELS
                : {})}
            />
            <Text className="text-sm leading-6 text-foreground">Lý do: {view.reason}</Text>
            <Evidence ids={view.evidenceIds} />
            {canAnswer ? (
              <>
                <Checkbox
                  checked={consent}
                  disabled={w.busy}
                  onChange={(checked) => setConsented(checked ? view : null)}
                  label={CONSENT_APPROVE}
                />
                <Area
                  label="Nội dung cần chỉnh lại hoặc lý do từ chối"
                  value={note}
                  onChange={setNote}
                />
              </>
            ) : null}
          </View>
        </ModalShell>
      ) : null}

      {requestOpen ? (
        <ModalShell
          title="Bạn muốn điều chỉnh điều gì?"
          closeLabel="Đóng cửa sổ"
          closeDisabled={w.busy}
          onClose={() => setRequestOpen(false)}
          footer={
            <>
              <ActionButton
                label="Hủy"
                variant="secondary"
                disabled={w.busy}
                onClick={() => setRequestOpen(false)}
                className="grow"
              />
              <ActionButton
                label="Gửi yêu cầu cho chủ nhà"
                busy={w.busy}
                disabled={picking || message.trim().length < 10}
                onClick={() => void sendRequest()}
                className="grow"
              />
            </>
          }>
          <View className="gap-4">
            <Text className="text-sm leading-6 text-muted-foreground">
              Nêu mong muốn để chủ nhà xem xét và soạn đề xuất cụ thể. Bạn được duyệt lại trước khi
              ký; không phản hồi đúng hạn thì yêu cầu đóng lại.
            </Text>
            <Area
              label="Nội dung đề nghị"
              value={message}
              onChange={setMessage}
              placeholder="Ví dụ: Tôi mong giảm tiền thuê từ 2 triệu xuống 1 triệu/tháng, từ kỳ tháng sau…"
              disabled={w.busy}
            />
            <EvidencePicker
              {...EVIDENCE_PICK}
              label="Minh chứng (không bắt buộc)"
              value={requestFiles}
              onChange={setRequestFiles}
              onPickingChange={setPicking}
              disabled={w.busy}
            />
          </View>
        </ModalShell>
      ) : null}
    </Anchor>
  );
}
