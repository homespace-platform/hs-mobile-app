// OWNER: agent E. Full-screen map editor with templates (web BranchLayoutEditor + LayoutBoard +
// LayoutDialogs). Design: docs/chi-nhanh/00-thiet-ke.md section 6. The props are final.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { useToast } from '@/components/rental/onboarding/common';
import { useViewer } from '@/components/rental/requests/useViewer';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { ScreenHeader } from '@/components/Screen';
import { branchError } from '@/lib/branch-error';
import {
  MAX_FLOORS,
  addFloor,
  addRooms,
  addRow,
  applyEdit,
  countRooms,
  createHistory,
  duplicateFloor,
  fromLayout,
  nextRoomCode,
  sameLayout,
  undoEdit,
  validateDraft,
  type DraftHistory,
} from '@/lib/branch-layout';
import type { StoredDraft } from '@/lib/branch-layout-draft';
import { saveWithLinks, type LostRoom } from '@/lib/branch-layout-save';
import { setLeaveGuard } from '@/lib/leave-guard';
import { branchDraftStore } from '@/services/branchDraftStore';
import { branchAssignmentApi, branchLayoutApi } from '@/services/branchMonitorApi';
import type { BranchAssignments } from '@/types/branch-assignment';
import type { BranchLayout, LayoutDraft } from '@/types/branch-layout';

import LayoutBoard from './LayoutBoard';
import LayoutSheets, { type SheetTarget } from './LayoutSheets';
import { createDraftSession, pickFloor } from './logic';
import TemplatePicker from './TemplatePicker';
import { Action, Empty, Note } from './ui';

export interface BranchMapEditorProps {
  branchId: string;
  /** The branch was just created: the step is optional ("Bỏ qua" / "Xong"). */
  setup: boolean;
  canEdit: boolean;
  lockMessage?: string | null;
  /**
   * Leaves the editor; the shell then reads the map again. This component asks about unsaved changes
   * first, also on Android back (ScreenHeader onBack) and through lib/leave-guard.
   */
  onClose: () => void;
}

const LEAVE = {
  title: 'Bỏ thay đổi chưa lưu?',
  description: 'Sơ đồ có thay đổi chưa lưu. Nếu rời đi, các thay đổi này sẽ mất.',
  confirmLabel: 'Bỏ thay đổi',
  cancelLabel: 'Ở lại',
  tone: 'warning' as const,
};

export default function BranchMapEditor({
  branchId,
  setup,
  canEdit,
  lockMessage,
  onClose,
}: BranchMapEditorProps) {
  const showDialog = useDialog();
  const toast = useToast();
  const { confirm } = useActionDialog();
  // The stored draft is per account: nothing is read, written or edited before the id is known.
  const { userId, failed, retry } = useViewer();
  const session = useMemo(
    () => (userId ? createDraftSession(branchDraftStore, userId, branchId) : null),
    [userId, branchId]
  );

  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState<LayoutDraft>([]);
  const [history, setHistory] = useState<DraftHistory>(() => createHistory([]));
  const [saving, setSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  /** The server rejected a save: the map changed elsewhere. */
  const [conflict, setConflict] = useState(false);
  /** Set while the screen holds a restored draft: the revision it was edited from. */
  const [restoredFrom, setRestoredFrom] = useState<number | null>(null);
  const [pickingTemplate, setPickingTemplate] = useState(false);
  /** A draft left on this device, waiting for the owner to restore or drop it. */
  const [offer, setOffer] = useState<StoredDraft | null>(null);
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [notice, setNotice] = useState('');
  const [picked, setPicked] = useState({ key: '', index: 0 });
  const loadSeq = useRef(0);
  const savingRef = useRef(false);

  const draft = history.present;
  const dirty = phase === 'ready' && !sameLayout(draft, saved);
  const editable = canEdit && !saving && !offer;
  // A draft from another revision is for re-applying only; saving stays locked, like after a 409.
  const stale = conflict || (restoredFrom !== null && restoredFrom !== revision);
  const draftRevision = restoredFrom ?? revision;

  const resetDraft = (tree: LayoutDraft) => {
    setHistory(createHistory(tree));
    setRestoredFrom(null);
    setSaveErrors([]);
    setPickingTemplate(false);
    setTarget(null);
  };
  const adopt = (layout: BranchLayout) => {
    const tree = fromLayout(layout);
    setRevision(layout.revision);
    setSaved(tree);
    setConflict(false);
    resetDraft(tree);
  };
  const adoptRef = useRef(adopt);
  adoptRef.current = adopt;

  /** `replaceDraft`: the owner agreed to lose the draft, but only once the new map is here. */
  const fetchLayout = useCallback(async (replaceDraft = false) => {
    if (!session) return;
    const seq = ++loadSeq.current;
    setPhase('loading');
    try {
      const layout = await branchLayoutApi.getLayout(branchId);
      if (seq !== loadSeq.current) return;
      if (replaceDraft) await session.forget();
      const stored = await session.open(layout);
      if (seq !== loadSeq.current) return;
      adoptRef.current(layout);
      setOffer(stored);
      setPhase('ready');
    } catch (error) {
      if (seq !== loadSeq.current) return;
      setLoadError(branchError(error, 'Chưa tải được sơ đồ.'));
      setPhase('error');
    }
  }, [branchId, session]);

  useEffect(() => {
    void fetchLayout();
    return () => {
      loadSeq.current++;
    };
  }, [fetchLayout]);

  // While an offer is open, the stored draft must stay untouched.
  useEffect(() => {
    if (phase !== 'ready' || offer || !session) return;
    if (dirty) void session.keep({ revision: draftRevision, draft });
    else void session.forget();
  }, [phase, offer, dirty, draftRevision, draft, session]);

  const waitForSave = () => showDialog('Đang lưu sơ đồ', 'Vui lòng đợi lưu xong rồi mở lại.');

  /** Runs `go` right away, or after the owner agrees to lose the unsaved changes. */
  const leave = async (go: () => void) => {
    if (savingRef.current) return waitForSave();
    if (!dirty) return go();
    // The question must not sit under an open sheet.
    setTarget(null);
    if (!(await confirm(LEAVE))) return;
    if (savingRef.current) return waitForSave();
    // Also when `go` keeps this screen: what is shown and what is stored stay in step.
    resetDraft(saved);
    await session?.forget();
    go();
  };
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  // Navigation from outside the editor (push tap, profile gate) asks the same question.
  useEffect(() => setLeaveGuard((go) => void leaveRef.current(go)), []);

  const back = () => {
    if (pickingTemplate && draft.length > 0) setPickingTemplate(false);
    else void leave(onClose);
  };

  const edit = (next: LayoutDraft, message: string) => {
    setHistory((current) => applyEdit(current, next));
    setSaveErrors([]);
    setNotice(message);
  };
  /** An edit that adds a floor also shows it. */
  const editAndShowLast = (next: LayoutDraft, message: string) => {
    edit(next, message);
    setPicked({ key: next[next.length - 1].key, index: next.length - 1 });
  };

  const undo = () => {
    const previous = undoEdit(history);
    if (previous.present === saved) setRestoredFrom(null); // back on the loaded tree
    setHistory(previous);
    setSaveErrors([]);
    setNotice('Đã hoàn tác.');
  };

  const discard = async () => {
    const yes = await confirm({
      ...LEAVE,
      title: 'Huỷ các thay đổi?',
      description: 'Sơ đồ trở về bản đã lưu gần nhất.',
      cancelLabel: 'Quay lại',
    });
    if (!yes) return;
    resetDraft(saved);
    setNotice('Đã huỷ các thay đổi.');
  };

  const restore = (stored: StoredDraft) => {
    session?.takeOver(stored);
    setRestoredFrom(stored.revision);
    setHistory(applyEdit(createHistory(saved), stored.draft));
    setOffer(null);
    setNotice('Đã khôi phục bản nháp.');
  };

  const reload = async () => {
    const yes = await confirm({
      ...LEAVE,
      title: 'Tải lại sơ đồ?',
      description: 'Bản nháp này sẽ mất. Hãy ghi lại các thay đổi cần áp lại trước khi tải.',
      confirmLabel: 'Tải lại',
      cancelLabel: 'Giữ bản nháp',
    });
    if (!yes) return;
    await fetchLayout(true);
  };

  /** Warns before a save that removes a room with attachments; the server decides what is allowed. */
  const askAboutLinks = async (lost: LostRoom[], links: BranchAssignments | null) => {
    const ask = (title: string, description: string) =>
      confirm({
        title,
        description,
        confirmLabel: 'Vẫn lưu',
        cancelLabel: 'Quay lại',
        tone: 'warning',
      });
    if (!links)
      return ask(
        'Chưa kiểm tra được liên kết phòng',
        'Chưa đọc được liên kết của các phòng sắp bỏ. Nếu vẫn lưu, liên kết trên những phòng này có thể bị gỡ: tin được gỡ khỏi phòng, hợp đồng cũ chuyển về khay Chưa xếp phòng. Nếu còn hợp đồng hiệu lực hoặc giữ chỗ, máy chủ sẽ từ chối cả lần lưu.'
      );
    const lines = lost.slice(0, 5).map((room) => `• Phòng ${room.code}: ${room.text}`);
    if (lost.length > 5) lines.push(`• và ${lost.length - 5} phòng khác`);
    return ask(
      'Lưu sẽ bỏ phòng đang có liên kết',
      `${lines.join('\n')}\n\nNếu còn hợp đồng hiệu lực hoặc giữ chỗ, máy chủ sẽ từ chối cả lần lưu. Nếu chỉ còn tin đăng hoặc hợp đồng cũ: tin được gỡ khỏi phòng, hợp đồng cũ chuyển về khay Chưa xếp phòng.`
    );
  };

  const save = async () => {
    if (savingRef.current || !dirty || stale || !session) return;
    const problems = validateDraft(draft);
    if (problems.length) {
      setSaveErrors(problems);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveErrors([]);
    setTarget(null);
    try {
      const outcome = await saveWithLinks(
        branchLayoutApi,
        () => branchAssignmentApi.getAssignments(branchId).catch(() => null),
        askAboutLinks,
        branchId,
        draft,
        saved,
        revision
      );
      if (outcome.kind === 'cancelled') return;
      if (outcome.kind === 'saved') {
        adopt(outcome.layout);
        await session.forget();
        setNotice('');
        toast.success('Đã lưu sơ đồ.');
      } else if (outcome.kind === 'conflict') setConflict(true);
      else setSaveErrors([outcome.message]);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const { floor, index: floorIndex } = pickFloor(draft, picked);
  const rooms = countRooms(draft);
  const showPicker = canEdit && !offer && (draft.length === 0 || pickingTemplate);
  const showBar =
    phase === 'ready' &&
    canEdit &&
    !offer &&
    !pickingTemplate &&
    (draft.length > 0 || history.past.length > 0);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScreenHeader
          title={setup ? 'Thiết lập sơ đồ phòng' : 'Sửa sơ đồ'}
          onBack={back}
          right={
            setup ? (
              <Pressable
                onPress={() => void leave(onClose)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                className={`ml-2 min-h-[48px] min-w-[48px] items-center justify-center ${saving ? 'opacity-50' : ''}`}>
                <Text className="text-sm font-bold text-primary">
                  {revision > 0 && !dirty ? 'Xong' : 'Bỏ qua'}
                </Text>
              </Pressable>
            ) : undefined
          }
        />
        {failed ? (
          <View className="p-4">
            <ErrorBlock
              message="Chưa xác định được tài khoản nên chưa sửa được sơ đồ."
              onRetry={retry}
            />
          </View>
        ) : phase === 'error' ? (
          <View className="p-4">
            <ErrorBlock message={loadError} onRetry={() => void fetchLayout()} />
          </View>
        ) : phase === 'loading' ? (
          <LoadingBlock label="Đang tải sơ đồ..." />
        ) : (
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-3 px-4 pb-8 pt-4">
            {setup ? (
              <Text className="text-sm leading-6 text-muted-foreground">
                Đã tạo chi nhánh. Bước này không bắt buộc, bạn có thể làm sau.
              </Text>
            ) : null}
            {!canEdit ? (
              <Note tone="warning" text={lockMessage ?? 'Bạn chưa có quyền sửa sơ đồ.'} />
            ) : null}
            {canEdit && offer ? (
              <Note
                tone="warning"
                text={`Trên máy này còn bản nháp sơ đồ chưa lưu (${countRooms(offer.draft)} phòng).${
                  offer.revision !== revision
                    ? ' Sơ đồ đã lưu đã thay đổi sau bản nháp này. Bạn có thể mở lại bản nháp để xem nhưng không lưu đè được: hãy ghi lại thay đổi, tải lại sơ đồ rồi làm lại.'
                    : ''
                }`}>
                <Action
                  label="Khôi phục bản nháp"
                  variant="primary"
                  onClick={() => restore(offer)}
                />
                <Action
                  label="Bỏ bản nháp"
                  onClick={() => {
                    void session?.drop(offer);
                    setOffer(null);
                  }}
                />
              </Note>
            ) : null}
            {stale ? (
              <Note
                tone="warning"
                text="Sơ đồ đã được thay đổi ở nơi khác nên chưa lưu được. Bản nháp của bạn vẫn còn đây. Hãy tải lại sơ đồ rồi làm lại các thay đổi.">
                <Action label="Tải lại sơ đồ" onClick={() => void reload()} />
              </Note>
            ) : null}

            {showPicker ? (
              <TemplatePicker
                disabled={!editable}
                onPick={(next) => {
                  edit(next, 'Đã tạo sơ đồ nháp. Bấm Lưu sơ đồ để giữ lại.');
                  setPicked({ key: '', index: 0 });
                  setPickingTemplate(false);
                }}
                onCancel={draft.length > 0 ? () => setPickingTemplate(false) : undefined}
              />
            ) : !floor ? (
              <Empty text="Chi nhánh này chưa có sơ đồ." />
            ) : (
              <>
                <Text className="text-sm leading-5 text-muted-foreground">
                  {rooms} phòng · {draft.length} tầng.
                  {editable ? ' Chạm vào ô để sửa, chạm + để thêm phòng.' : ''}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  accessibilityRole="tablist"
                  contentContainerClassName="gap-2">
                  {draft.map((item, index) => {
                    const selected = index === floorIndex;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setPicked({ key: item.key, index })}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        className={`min-h-[48px] justify-center rounded-full border-2 px-4 py-2 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                        <Text
                          className={`text-sm font-bold ${selected ? 'text-primary' : 'text-secondary'}`}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {editable && draft.length < MAX_FLOORS ? (
                    <Pressable
                      onPress={() => editAndShowLast(addFloor(draft), 'Đã thêm tầng.')}
                      accessibilityRole="button"
                      accessibilityLabel="Thêm tầng"
                      className="min-h-[48px] flex-row items-center gap-1 rounded-full border-2 border-dashed border-border-strong px-4 py-2 active:bg-muted">
                      <Icon name="add" size={18} className="text-primary" />
                      <Text className="text-sm font-bold text-primary">Thêm tầng</Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
                {editable ? (
                  <View className="flex-row flex-wrap gap-2">
                    <Action
                      label="Thêm dãy"
                      icon="add"
                      className="grow"
                      onClick={() => edit(addRow(draft, floor.key), 'Đã thêm dãy.')}
                    />
                    <Action
                      label="Nhân bản"
                      icon="copy-outline"
                      className="grow"
                      hint={`Nhân bản ${floor.label} với mã phòng mới`}
                      disabled={draft.length >= MAX_FLOORS}
                      onClick={() =>
                        editAndShowLast(
                          duplicateFloor(draft, floor.key),
                          'Đã nhân bản tầng với mã phòng mới.'
                        )
                      }
                    />
                    <Action
                      label="Tuỳ chọn tầng"
                      icon="ellipsis-horizontal"
                      className="grow"
                      onClick={() => setTarget({ type: 'floor', key: floor.key })}
                    />
                  </View>
                ) : null}
                <View className="rounded-2xl border border-border bg-surface p-3">
                  <LayoutBoard
                    floor={floor}
                    editable={editable}
                    onOpenCell={(key) => setTarget({ type: 'cell', key })}
                    onOpenRow={(key) => setTarget({ type: 'row', key })}
                    onAddRoom={(rowKey) =>
                      edit(addRooms(draft, rowKey), `Đã thêm phòng ${nextRoomCode(draft, rowKey)}.`)
                    }
                  />
                </View>
                {editable ? (
                  <View className="flex-row flex-wrap gap-2">
                    <Action
                      label="Đặt lại mã"
                      className="grow"
                      disabled={rooms === 0}
                      onClick={() => setTarget({ type: 'recode', key: '' })}
                    />
                    <Action
                      label="Chọn mẫu khác"
                      className="grow"
                      onClick={() => setPickingTemplate(true)}
                    />
                  </View>
                ) : null}
              </>
            )}

            {saveErrors.length > 0 ? (
              <Note
                tone="error"
                text={`Chưa lưu được. Bản nháp vẫn còn.\n${saveErrors
                  .slice(0, 5)
                  .map((message) => `• ${message}`)
                  .join('\n')}`}
              />
            ) : null}
          </ScrollView>
        )}

        {showBar ? (
          <View className="gap-2 border-t border-border bg-surface px-4 pb-3 pt-2">
            {/* The save button is always in reach, so its errors must be noticed from here too. */}
            <Text
              accessibilityLiveRegion="polite"
              className={`text-xs leading-5 ${saveErrors.length || stale ? 'font-bold text-danger' : 'text-muted-foreground'}`}>
              {saveErrors.length
                ? `Chưa lưu được: ${saveErrors[0]}`
                : stale
                  ? 'Chưa lưu được: sơ đồ đã thay đổi ở nơi khác.'
                  : notice || (dirty ? 'Có thay đổi chưa lưu.' : 'Chưa có thay đổi.')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Action
                label="Hoàn tác"
                icon="arrow-undo"
                disabled={!editable || history.past.length === 0}
                onClick={undo}
              />
              <Action
                label={saving ? 'Đang lưu…' : 'Lưu sơ đồ'}
                variant="primary"
                className="grow"
                busy={saving}
                disabled={!dirty || stale}
                onClick={() => void save()}
              />
            </View>
            {dirty ? (
              <Pressable
                onPress={() => void discard()}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                className={`min-h-[44px] items-center justify-center active:opacity-70 ${saving ? 'opacity-50' : ''}`}>
                <Text className="text-sm font-bold text-danger">Huỷ thay đổi</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <LayoutSheets
          draft={draft}
          target={editable ? target : null}
          onTarget={setTarget}
          apply={(next, message) => {
            edit(next, next === draft ? '' : message);
            setTarget(null);
          }}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
