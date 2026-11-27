// OWNER: agent E. What is linked to one saved room and its actions (web RoomPanel + CandidatePicker).
// It is drawn inside agent V's room sheet (a ModalShell): no own Modal outside its children, no
// ScrollView. It loads the assignments itself. The props are final.
import { useCallback, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { useActionDialog, type ConfirmOptions } from '@/components/rental/shared/ActionDialog';
import {
  MANUAL_STATUS_LABEL,
  codeMismatch,
  codeTaken,
  contractStatusLabel,
  editListingDestination,
  emptyRoom,
  formatDay,
  itemDestination,
  listingLinkOutcome,
  listingStatusLabel,
  newRoomListingDestination,
  permissionBlock,
  primaryAction,
  rentalRequestDestination,
  sortContracts,
} from '@/lib/branch-assignment';
import { branchError } from '@/lib/branch-error';
import type { BranchNav } from '@/lib/branch-nav';
import { useBranchRead } from '@/lib/use-branch-read';
import { branchAssignmentApi } from '@/services/branchMonitorApi';
import type {
  AssignmentKind,
  RoomContractLink,
  RoomListingLink,
  RoomManualStatus,
  RoomOption,
} from '@/types/branch-assignment';

import CandidatePicker from './CandidatePicker';
import { Action, Empty, Heading, Note, RoomChoices, Row } from './ui';
import { reloadTray, useLinkAction } from './useLinkAction';

export interface RoomLinksPanelProps {
  branchId: string;
  roomId: string;
  code: string;
  /** Every room of the saved map, for "Chuyển phòng". */
  rooms: RoomOption[];
  canEdit: boolean;
  lockMessage?: string | null;
  nav: BranchNav;
  /** Call after every write, also a failed one: the status on screen may have changed. */
  onChanged: () => void;
  /** Renames this cell on the map (the layout save). Rejects with the reason when it cannot. */
  onRecode?: (roomId: string, code: string) => Promise<void>;
}

const STATUSES = Object.keys(MANUAL_STATUS_LABEL) as RoomManualStatus[];
const TRAY = '';

const describe = (error: unknown) => branchError(error, 'Chưa tải được phần gắn tin và hợp đồng.');

/** A list that takes the panel's place until it is closed. */
type ListView = null | { pick: AssignmentKind } | { move: RoomContractLink };

function LinkCard({
  title,
  lines,
  warning,
  children,
}: {
  title: string;
  lines: string[];
  /** Sits right under the item it is about. */
  warning?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-2 rounded-2xl border border-border bg-surface p-3">
      <View className="gap-0.5">
        <Text className="text-sm font-bold text-foreground">{title}</Text>
        {lines.map((line) => (
          <Text key={line} className="text-sm leading-5 text-muted-foreground">
            {line}
          </Text>
        ))}
      </View>
      {warning}
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

export default function RoomLinksPanel({
  branchId,
  roomId,
  code,
  rooms,
  canEdit,
  lockMessage,
  nav,
  onChanged,
  onRecode,
}: RoomLinksPanelProps) {
  const { confirm } = useActionDialog();
  const load = useCallback(() => branchAssignmentApi.getAssignments(branchId), [branchId]);
  const { data, error: loadError, loading, reload } = useBranchRead(load, describe);
  const { busy, error, success, note, run, clear } = useLinkAction(async () => {
    void reloadTray();
    onChanged();
    await reload();
  });
  const [view, setView] = useState<ListView>(null);
  /** The marks sit at the bottom: their answer is shown beside them, not off screen at the top. */
  const [marking, setMarking] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false);

  if (!data)
    return loadError ? (
      <ErrorBlock message={loadError} busy={loading} onRetry={() => void reload()} />
    ) : (
      <LoadingBlock label="Đang tải liên kết tin và hợp đồng..." />
    );

  const room = data.rooms.find((item) => item.roomId === roomId) ?? emptyRoom(roomId);
  const lock = permissionBlock(canEdit, lockMessage);
  const disabled = busy || lock !== null;
  const empty = !room.contracts.length && !room.holds.length && !room.listings.length;
  const show = (next: ListView) => {
    clear();
    setMarking(false);
    setView(next);
  };
  const notes = (
    <>
      <Note tone="warning" text={lock} />
      <Note
        tone="warning"
        text={loadError ? `Chưa tải lại được, thông tin có thể đã cũ. ${loadError}` : null}>
        <Action label="Thử lại" busy={loading} onClick={() => void reload()} />
      </Note>
    </>
  );
  const result = (
    <>
      <Note tone="error" text={error} />
      <Note tone="success" text={success} />
      <Note tone="warning" text={note} />
    </>
  );
  /** Asked first: on a phone these buttons are easy to hit by accident. */
  const remove = async (options: ConfirmOptions, action: () => Promise<void>, done: string) => {
    if (!(await confirm({ tone: 'warning', ...options }))) return;
    setMarking(false);
    await run(action, done);
  };

  if (view)
    return (
      <View className="gap-3">
        <Heading>
          {'move' in view
            ? 'Chuyển hợp đồng đến'
            : `Chọn ${view.pick === 'CONTRACT' ? 'hợp đồng' : 'tin đăng'} cho phòng ${code}`}
        </Heading>
        <Action label="Đóng danh sách" icon="close" onClick={() => show(null)} />
        {notes}
        {result}
        {'move' in view ? (
          <RoomChoices
            disabled={disabled}
            choices={[
              { value: TRAY, label: 'Khay Chưa xếp phòng' },
              ...rooms
                .filter((item) => item.id !== roomId)
                .map((item) => ({ value: item.id, label: item.label })),
            ]}
            onPick={(target) =>
              void run(
                () => branchAssignmentApi.putContract(branchId, view.move.id, target || null),
                'Đã chuyển hợp đồng.'
              ).then((ok) => {
                if (ok) setView(null);
              })
            }
          />
        ) : (
          <CandidatePicker
            key={view.pick}
            branchId={branchId}
            kind={view.pick}
            roomId={roomId}
            cellCode={code}
            rooms={rooms}
            disabled={disabled}
            onPick={async (candidate) => {
              const contract = view.pick === 'CONTRACT';
              const other = contract ? null : codeMismatch(code, candidate.roomCode);
              const ok = await run(
                () =>
                  contract
                    ? branchAssignmentApi.putContract(branchId, candidate.id, roomId)
                    : branchAssignmentApi
                        .linkListing(branchId, roomId, candidate.id)
                        .then((result) => listingLinkOutcome(result, code, other)),
                `Đã gắn hợp đồng vào phòng ${code}.`
              );
              if (ok) setView(null);
              return ok;
            }}
          />
        )}
      </View>
    );

  const primary = primaryAction(room);
  const openPrimary = () => {
    if (primary.kind === 'attach') return show({ pick: 'LISTING' });
    nav.open(
      primary.kind === 'contract'
        ? itemDestination('CONTRACT', primary.id)
        : primary.kind === 'hold'
          ? rentalRequestDestination(primary.id)
          : itemDestination('LISTING', primary.id)
    );
  };
  const markLabel = MANUAL_STATUS_LABEL[room.manualStatus];

  /** Mismatch under the listing: change the cell (map save) or fix the listing (editor). */
  const codeWarning = (listing: RoomListingLink) => {
    const declared = codeMismatch(code, listing.roomCode);
    if (!declared) return null;
    return (
      <Note
        tone="warning"
        text={`Mã trên tin là "${declared}", khác mã ô ${code}. Sơ đồ là chuẩn: nên đổi mã ô hoặc sửa mã trên tin.`}>
        {codeTaken(rooms, roomId, declared) ? (
          <Text className="text-sm leading-5 text-warning">
            Mã "{declared}" đã là của ô khác nên chưa đổi mã ô được.
          </Text>
        ) : onRecode ? (
          <Action
            label={`Đổi mã ô thành ${declared}`}
            variant="warning"
            disabled={disabled}
            onClick={() =>
              void run(() => onRecode(roomId, declared), `Đã đổi mã ô thành ${declared}.`)
            }
          />
        ) : null}
        <Action
          label="Sửa mã trên tin"
          variant="warning"
          onClick={() =>
            void confirm({
              title: 'Sửa mã trên tin?',
              description:
                'Mở trang sửa tin. Tin đang hiển thị sẽ phải được duyệt lại sau khi lưu thay đổi.',
              confirmLabel: 'Mở trang sửa tin',
              cancelLabel: 'Để sau',
              tone: 'warning',
            }).then((yes) => {
              if (yes) nav.open(editListingDestination(listing.id));
            })
          }
        />
      </Note>
    );
  };

  return (
    <View className="gap-4">
      {notes}
      {marking ? null : result}

      <Action
        label={primary.label}
        variant="primary"
        icon={primary.kind === 'attach' ? 'link-outline' : 'open-outline'}
        disabled={primary.kind === 'attach' && disabled}
        onClick={openPrimary}
      />

      <View className="gap-3">
        <Heading>Liên kết</Heading>
        {empty ? <Empty text="Phòng này chưa gắn hợp đồng hay tin đăng." /> : null}

        {sortContracts(room.contracts).map((contract) => {
          const tenant = contract.tenantName || 'chưa có tên người thuê';
          const start = formatDay(contract.startDate);
          const end = formatDay(contract.endDateExclusive);
          return (
            <LinkCard
              key={contract.id}
              title={`Hợp đồng · ${tenant}`}
              lines={[
                [
                  contractStatusLabel(contract.status),
                  start && `từ ${start}`,
                  end && `đến trước ${end}`,
                ]
                  .filter(Boolean)
                  .join(' · '),
              ]}>
              {primary.kind === 'contract' && primary.id === contract.id ? null : (
                <Action
                  label="Mở hợp đồng"
                  link
                  icon="open-outline"
                  className="w-full"
                  onClick={() => nav.open(itemDestination('CONTRACT', contract.id))}
                />
              )}
              <Action
                label="Chuyển phòng"
                className="grow"
                disabled={disabled}
                onClick={() => show({ move: contract })}
              />
              <Action
                label="Gỡ khỏi chi nhánh"
                className="grow"
                disabled={disabled}
                onClick={() =>
                  void remove(
                    {
                      title: 'Gỡ hợp đồng khỏi chi nhánh?',
                      description: `Hợp đồng của ${tenant} chỉ được gỡ khỏi chi nhánh. Điều khoản hợp đồng không thay đổi.`,
                      confirmLabel: 'Gỡ khỏi chi nhánh',
                    },
                    () => branchAssignmentApi.removeContract(branchId, contract.id),
                    'Đã gỡ hợp đồng khỏi chi nhánh.'
                  )
                }
              />
            </LinkCard>
          );
        })}

        {room.holds.map((hold) => (
          <LinkCard
            key={hold.rentalRequestId}
            title={`Giữ chỗ · ${hold.tenantName || 'chưa có tên người thuê'}`}
            lines={formatDay(hold.moveInDate) ? [`Ngày vào ${formatDay(hold.moveInDate)}`] : []}>
            {primary.kind === 'hold' && primary.id === hold.rentalRequestId ? null : (
              <Action
                label="Mở hồ sơ thuê"
                link
                icon="open-outline"
                className="w-full"
                onClick={() => nav.open(rentalRequestDestination(hold.rentalRequestId))}
              />
            )}
          </LinkCard>
        ))}

        {room.listings.map((listing) => {
          const declared = listing.roomCode?.trim();
          return (
            <LinkCard
              key={listing.id}
              title={`Tin đăng · ${listing.title}`}
              lines={[
                [listingStatusLabel(listing.operationalStatus), declared && `mã ${declared}`]
                  .filter(Boolean)
                  .join(' · '),
              ]}
              warning={codeWarning(listing)}>
              {primary.kind === 'listing' && primary.id === listing.id ? null : (
                <Action
                  label="Mở tin"
                  link
                  icon="open-outline"
                  className="grow"
                  onClick={() => nav.open(itemDestination('LISTING', listing.id))}
                />
              )}
              <Action
                label="Gỡ khỏi phòng"
                className="grow"
                disabled={disabled}
                onClick={() =>
                  void remove(
                    {
                      title: 'Gỡ tin khỏi phòng?',
                      description: `Tin "${listing.title}" chỉ được gỡ khỏi phòng ${code}, tin đăng vẫn giữ nguyên.`,
                      confirmLabel: 'Gỡ khỏi phòng',
                    },
                    () => branchAssignmentApi.unlinkListing(branchId, roomId, listing.id),
                    'Đã gỡ tin khỏi phòng.'
                  )
                }
              />
            </LinkCard>
          );
        })}

        {primary.kind === 'attach' ? null : (
          <Row title="Gắn tin" disabled={disabled} onPress={() => show({ pick: 'LISTING' })} />
        )}
        <Row
          title="Đăng tin cho phòng này"
          disabled={disabled}
          onPress={() => nav.open(newRoomListingDestination(branchId, roomId))}
        />
        <Row
          title="Gắn hợp đồng có sẵn"
          disabled={disabled}
          onPress={() => show({ pick: 'CONTRACT' })}
        />
        <Text className="text-xs leading-4 text-muted-foreground">
          Chỉ dùng cho hợp đồng không gắn với tin nào trong chi nhánh này.
        </Text>
      </View>

      <View accessibilityRole="radiogroup" className="gap-2">
        <Row
          title="Đánh dấu phòng"
          detail={markLabel}
          expanded={marksOpen}
          onPress={() => setMarksOpen((open) => !open)}
          accessibilityLabel={`Đánh dấu phòng: ${markLabel}. ${marksOpen ? 'Bấm để thu gọn' : 'Bấm để mở'}`}
        />
        {marksOpen
          ? STATUSES.map((status) => (
              <Row
                key={status}
                title={MANUAL_STATUS_LABEL[status]}
                selected={room.manualStatus === status}
                disabled={disabled}
                onPress={() => {
                  if (room.manualStatus === status) return;
                  setMarking(true);
                  void run(
                    () => branchAssignmentApi.setManualStatus(branchId, roomId, status),
                    'Đã cập nhật đánh dấu phòng.'
                  );
                }}
              />
            ))
          : null}
        {marking ? result : null}
      </View>
    </View>
  );
}
