// OWNER: agent E. The "Chưa xếp phòng" tray (web UnplacedTray): an entry row with its count, and a
// sheet that is open while `open`. The "#unplaced" attention target sets `open`. The props are final.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type ScrollView } from 'react-native';

import Icon from '@/components/Icon';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import ModalShell from '@/components/rental/shared/ModalShell';
import { LoadingBlock } from '@/components/rental/shared/StateBlocks';
import {
  itemDestination,
  listingLinkOutcome,
  pageCount,
  permissionBlock,
} from '@/lib/branch-assignment';
import { branchError } from '@/lib/branch-error';
import type { BranchNav } from '@/lib/branch-nav';
import { useBranchRead } from '@/lib/use-branch-read';
import { branchAssignmentApi } from '@/services/branchMonitorApi';
import type { RoomOption, UnplacedItem } from '@/types/branch-assignment';

import CandidatePicker from './CandidatePicker';
import { addOldContract } from './logic';
import { Action, Empty, Heading, Note, Pager, RoomChoices, Row } from './ui';
import { useLinkAction, useTrayReload } from './useLinkAction';

export interface UnplacedTrayProps {
  branchId: string;
  /** Every room of the saved map; empty when there is no map (contracts can still join the tray). */
  rooms: RoomOption[];
  canEdit: boolean;
  lockMessage?: string | null;
  nav: BranchNav;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Call after every write, also a failed one. */
  onChanged: () => void;
}

const TRAY = '';
const describe = (error: unknown) => branchError(error, 'Chưa tải được phần gắn tin và hợp đồng.');
const noun = (item: UnplacedItem) => (item.kind === 'CONTRACT' ? 'hợp đồng' : 'tin');

/** What the sheet shows in place of the list. */
type Step = null | { place: UnplacedItem } | { add: true };

export default function UnplacedTray({ open, onOpenChange, ...props }: UnplacedTrayProps) {
  const { branchId } = props;
  const [page, setPage] = useState(0);
  const load = useCallback(
    () => branchAssignmentApi.getAssignments(branchId, page),
    [branchId, page]
  );
  const read = useBranchRead(load, describe);
  const { data, error, reload } = read;
  // Another page is another `load`: keep the last count on the entry row meanwhile.
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!data) return;
    setTotal(data.unplaced.totalElements);
    const last = pageCount(data.unplaced) - 1;
    if (page > last) setPage(last);
  }, [data, page]);
  useTrayReload(reload);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) void reload();
    wasOpen.current = open;
  }, [open, reload]);

  const count = total === null ? '' : ` (${total})`;
  return (
    <>
      <Pressable
        onPress={() => onOpenChange(true)}
        accessibilityRole="button"
        accessibilityLabel={`Chưa xếp phòng${count}. ${error || 'Mở danh sách hợp đồng và tin chưa xếp phòng.'}`}
        className={`min-h-[56px] flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:bg-muted ${total ? 'border-warning bg-warning-soft' : 'border-border bg-surface'}`}>
        <Icon
          name="file-tray-outline"
          size={22}
          className={total ? 'text-warning' : 'text-muted-foreground'}
        />
        <View className="flex-1">
          <Text className="text-sm font-bold text-foreground">Chưa xếp phòng{count}</Text>
          {error ? <Text className="text-xs leading-5 text-danger">{error}</Text> : null}
        </View>
        <Icon name="chevron-forward" size={18} className="text-muted-foreground" />
      </Pressable>
      {open ? (
        <TraySheet
          {...props}
          title={`Chưa xếp phòng${count}`}
          read={read}
          page={page}
          onPage={setPage}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </>
  );
}

function TraySheet({
  title,
  branchId,
  rooms,
  canEdit,
  lockMessage,
  nav,
  onChanged,
  read,
  page,
  onPage,
  onClose,
}: Omit<UnplacedTrayProps, 'open' | 'onOpenChange'> & {
  title: string;
  read: ReturnType<
    typeof useBranchRead<Awaited<ReturnType<typeof branchAssignmentApi.getAssignments>>>
  >;
  page: number;
  onPage: (page: number) => void;
  onClose: () => void;
}) {
  const { data, error: loadError, loading, reload } = read;
  const { busy, error, success, note, run, clear } = useLinkAction(async () => {
    onChanged();
    await reload();
  });
  const [step, setStep] = useState<Step>(null);
  /** Where an added contract goes; "" = the tray. */
  const [addTo, setAddTo] = useState(TRAY);
  const [choosingTarget, setChoosingTarget] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lock = permissionBlock(canEdit, lockMessage);
  const choices = rooms.map((room) => ({ value: room.id, label: room.label }));
  const target = rooms.find((room) => room.id === addTo) ?? null;
  const unplaced = data?.unplaced;

  const show = (next: Step) => {
    clear();
    setChoosingTarget(false);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const act = (
    action: () => Promise<void | { success?: string; note?: string | null }>,
    done: string
  ) =>
    run(action, done).then((ok) => {
      if (ok) setStep(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return ok;
    });

  return (
    <ModalShell
      title={title}
      scrollRef={scrollRef}
      // Android back and the X leave a sub-list first.
      onClose={() => (step ? show(null) : onClose())}>
      <ConfirmingBody>
        {(confirm) => (
          <View className="gap-3">
            {step ? (
              <Action label="Đóng danh sách" icon="close" onClick={() => show(null)} />
            ) : null}
            <Note tone="warning" text={lock} />
            <Note
              tone="warning"
              text={
                loadError
                  ? `${data ? 'Chưa tải lại được, danh sách có thể đã cũ.' : 'Chưa tải được phần gắn tin và hợp đồng.'} ${loadError}`
                  : null
              }>
              <Action label="Thử lại" busy={loading} onClick={() => void reload()} />
            </Note>
            <Note tone="error" text={error} />
            <Note tone="success" text={success} />
            <Note tone="warning" text={note} />

            {step && 'place' in step ? (
              <>
                <Heading>{`Xếp phòng cho ${noun(step.place)}`}</Heading>
                <Text className="text-sm leading-5 text-muted-foreground">{step.place.label}</Text>
                <RoomChoices
                  choices={choices}
                  disabled={busy || lock !== null}
                  onPick={(roomId) =>
                    void act(
                      () =>
                        step.place.kind === 'CONTRACT'
                          ? branchAssignmentApi.putContract(branchId, step.place.id, roomId)
                          : branchAssignmentApi
                              .linkListing(branchId, roomId, step.place.id)
                              .then((result) =>
                                listingLinkOutcome(
                                  result,
                                  rooms.find((r) => r.id === roomId)?.code ?? '',
                                  null
                                )
                              ),
                      'Đã xếp phòng.'
                    )
                  }
                />
              </>
            ) : step ? (
              <>
                <Heading>Thêm hợp đồng cũ</Heading>
                <Row
                  title="Thêm hợp đồng vào"
                  detail={target?.label ?? 'Khay Chưa xếp phòng (chưa biết phòng)'}
                  expanded={choosingTarget}
                  disabled={busy || rooms.length === 0}
                  onPress={() => setChoosingTarget((value) => !value)}
                />
                {choosingTarget ? (
                  <RoomChoices
                    selected={target?.id ?? TRAY}
                    choices={[
                      { value: TRAY, label: 'Khay Chưa xếp phòng (chưa biết phòng)' },
                      ...choices,
                    ]}
                    onPick={(value) => {
                      setAddTo(value);
                      setChoosingTarget(false);
                    }}
                  />
                ) : (
                  <CandidatePicker
                    branchId={branchId}
                    kind="CONTRACT"
                    roomId={target?.id ?? null}
                    rooms={rooms}
                    disabled={busy || lock !== null}
                    trayIds={
                      new Set(unplaced?.items.filter((i) => i.kind === 'CONTRACT').map((i) => i.id))
                    }
                    onPick={(candidate) =>
                      act(
                        () =>
                          addOldContract(
                            branchAssignmentApi,
                            branchId,
                            candidate.id,
                            target?.id ?? null
                          ),
                        'Đã thêm hợp đồng vào chi nhánh.'
                      )
                    }
                  />
                )}
              </>
            ) : (
              <>
                <Action
                  label="Thêm hợp đồng cũ"
                  variant="primary"
                  icon="add"
                  disabled={busy || lock !== null}
                  onClick={() => show({ add: true })}
                />
                {!unplaced && !loadError ? (
                  <LoadingBlock label="Đang tải liên kết tin và hợp đồng..." />
                ) : null}
                {rooms.length === 0 && unplaced?.items.length ? (
                  <Note
                    tone="warning"
                    text="Sơ đồ chưa có phòng đã lưu. Tạo và lưu sơ đồ rồi mới xếp phòng được."
                  />
                ) : null}
                {unplaced && unplaced.items.length === 0 ? (
                  <Empty text="Không có hợp đồng hay tin nào chờ xếp phòng." />
                ) : null}
                {unplaced?.items.map((item) => (
                  <View
                    key={`${item.kind}-${item.id}`}
                    className="gap-2 rounded-2xl border border-border bg-surface p-3">
                    <View className="gap-0.5">
                      <Text className="text-xs font-semibold text-muted-foreground">
                        {item.kind === 'CONTRACT' ? 'Hợp đồng' : 'Tin đăng'}
                      </Text>
                      <Text className="text-sm font-bold text-foreground">{item.label}</Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      <Action
                        label="Xếp phòng"
                        className="grow"
                        icon="grid-outline"
                        disabled={busy || lock !== null || rooms.length === 0}
                        onClick={() => show({ place: item })}
                      />
                      <Action
                        label="Mở"
                        link
                        className="grow"
                        icon="open-outline"
                        // The sheet stays "open" in the shell, so Back returns to it.
                        onClick={() => nav.open(itemDestination(item.kind, item.id))}
                      />
                      {item.kind === 'CONTRACT' ? (
                        <Action
                          label="Gỡ khỏi chi nhánh"
                          className="w-full"
                          disabled={busy || lock !== null}
                          onClick={() =>
                            void confirm({
                              title: 'Gỡ hợp đồng khỏi chi nhánh?',
                              description: `${item.label} chỉ được gỡ khỏi chi nhánh. Điều khoản hợp đồng không thay đổi.`,
                              confirmLabel: 'Gỡ khỏi chi nhánh',
                              tone: 'warning',
                            }).then((yes) => {
                              if (yes)
                                void act(
                                  () => branchAssignmentApi.removeContract(branchId, item.id),
                                  'Đã gỡ hợp đồng khỏi chi nhánh.'
                                );
                            })
                          }
                        />
                      ) : null}
                    </View>
                  </View>
                ))}
                {unplaced ? (
                  <Pager
                    page={page}
                    pages={pageCount(unplaced)}
                    disabled={loading || busy}
                    onPage={onPage}
                  />
                ) : null}
              </>
            )}
          </View>
        )}
      </ConfirmingBody>
    </ModalShell>
  );
}

/** Inside the sheet, so the confirm question is drawn by the sheet's own dialog host (iOS). */
function ConfirmingBody({
  children,
}: {
  children: (confirm: ReturnType<typeof useActionDialog>['confirm']) => React.ReactNode;
}) {
  const { confirm } = useActionDialog();
  return <>{children(confirm)}</>;
}
