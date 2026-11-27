// Status view of the saved map: layers, legend, month, search, floors, room sheet. It only shows and
// leads: every state, order and deadline is the server's. Design: docs/chi-nhanh/00-thiet-ke.md §5.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { reloadTray } from '@/components/branch/editing/useLinkAction';
import EntryList from '@/components/branch/view/EntryList';
import FloorBoard, { type CellContent } from '@/components/branch/view/FloorBoard';
import {
  FloorPicker,
  LayerPicker,
  Legend,
  ModeSwitch,
  MonthPicker,
  SearchBox,
} from '@/components/branch/view/MapControls';
import RoomSheet from '@/components/branch/view/RoomSheet';
import ActionButton from '@/components/rental/shared/ActionButton';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { mismatchedRoomIds, roomOptions } from '@/lib/branch-assignment';
import { branchError } from '@/lib/branch-error';
import { findSlot } from '@/lib/branch-layout';
import type { BranchNav, BranchViewState } from '@/lib/branch-nav';
import {
  LAYER_LABEL,
  layerReady,
  monthLabel,
  roomLayerStatus,
  type OverviewLayer,
  type OverviewTarget,
} from '@/lib/branch-overview';
import { layerLook } from '@/lib/branch-status';
import {
  cellLabel,
  cellLines,
  layerEntries,
  legendItems,
  mapSummary,
  unplacedEntries,
} from '@/lib/branch-view';
import { useBranchRead, useNowMs } from '@/lib/use-branch-read';
import { branchAssignmentApi, branchOverviewApi } from '@/services/branchMonitorApi';
import type { DraftSlot, LayoutDraft } from '@/types/branch-layout';

export interface BranchMapViewProps {
  branchId: string;
  /** The saved map; never empty. Cells with a roomCode are rooms and their `id` is the roomId. */
  floors: LayoutDraft;
  /** Held by the shell so Back from another screen restores it. */
  view: BranchViewState;
  onViewChange: (patch: Partial<BranchViewState>) => void;
  nav: BranchNav;
  canEdit: boolean;
  /** Opens the map editor. */
  onEditMap: () => void;
  /** Reads the saved map again (pull to refresh, next to the overview). */
  onRefreshLayout: () => Promise<void>;
  /** Links and actions of one room (agent E), drawn inside the room sheet. */
  renderRoomLinks: (room: { roomId: string; code: string }, onChanged: () => void) => ReactNode;
  /** The "Chưa xếp phòng" entry and its sheet (agent E); always render it once, below the map. */
  renderTray: (onChanged: () => void) => ReactNode;
}

const NOTE: Partial<Record<OverviewLayer, string>> = {
  payments: 'Gồm khoản có hạn trong tháng và nợ quá hạn của các tháng trước.',
  meters: 'Bấm vào phòng để mở hóa đơn của hợp đồng; việc ghi chỉ số làm ở đó.',
  contracts:
    'Hợp đồng đã xếp phòng còn tối đa 60 ngày. Hợp đồng chưa xếp phòng xem ở mục Cần chú ý.',
};

const describeError = (error: unknown) => branchError(error, 'Máy chủ chưa trả lời được.');

export default function BranchMapView({
  branchId,
  floors,
  view,
  onViewChange,
  nav,
  canEdit,
  onEditMap,
  onRefreshLayout,
  renderRoomLinks,
  renderTray,
}: BranchMapViewProps) {
  const { layer, month } = view;
  const load = useCallback(
    () => branchOverviewApi.getOverview(branchId, month || undefined),
    [branchId, month]
  );
  // `data` is null as soon as the month changes, so another month is never shown.
  const { data, error, at, loading, reload } = useBranchRead(load, describeError);
  // The listings' codes, only to mark cells; the room sheet reads its own copy.
  const loadLinks = useCallback(() => branchAssignmentApi.getAssignments(branchId), [branchId]);
  const links = useBranchRead(loadLinks, describeError);
  const flagged = useMemo(
    () => (links.data ? mismatchedRoomIds(links.data.rooms, roomOptions(floors)) : undefined),
    [links.data, floors]
  );
  const elapsed = Math.max(0, useNowMs() - at);

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<{ layer: OverviewLayer; status: string } | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const ready = !data || layerReady(data, layer);
  const highlight = data && ready && picked?.layer === layer ? picked.status : null;
  const rooms = useMemo(() => new Map(data?.rooms.map((room) => [room.roomId, room])), [data]);
  const { filtering, counts, matched, perFloor, leaseStatus } = mapSummary(
    floors,
    rooms,
    layer,
    query,
    highlight
  );
  const floor = floors.find((item) => item.id === view.floorId) ?? floors[0];
  /** Another floor to jump to when everything that matches is elsewhere. */
  const elsewhere =
    filtering && !perFloor.get(floor.key) ? floors.find((item) => perFloor.get(item.key)) : null;

  const waiting = !data && (loading || !error);
  const stale = data && error ? `Chưa tải lại được, tình trạng có thể đã cũ. ${error}` : '';

  const shownRoom = (slot: DraftSlot) => (ready ? rooms.get(slot.id ?? '') : undefined);
  const cellContent = (slot: DraftSlot): CellContent => {
    const room = shownRoom(slot);
    if (!data || !room)
      return {
        look: { icon: waiting ? 'time-outline' : 'remove-outline', tone: 'neutral' },
        label: waiting ? 'Đang tải…' : 'Chưa có dữ liệu',
        lines: [],
      };
    const status = roomLayerStatus(room, layer);
    return {
      look: layerLook(layer, status),
      label: cellLabel(room, layer),
      lines: cellLines(room, layer, data, elapsed),
    };
  };

  const found = openKey ? findSlot(floors, openKey) : null;
  const open =
    found && found.slot.id && found.slot.roomCode !== null
      ? { ...found, id: found.slot.id, code: found.slot.roomCode }
      : null;
  const openRoom = open ? shownRoom(open.slot) : undefined;

  const openTarget = (target: OverviewTarget) => {
    setOpenKey(null);
    nav.openTarget(target);
  };
  const changed = () => void Promise.all([reload(), links.reload()]);
  const refresh = async () => {
    setPulling(true);
    await Promise.all([reload(), links.reload(), onRefreshLayout(), reloadTray()]);
    setPulling(false);
  };

  const unplaced = data ? unplacedEntries(data, elapsed) : [];

  return (
    <>
      <ScrollView
        contentContainerClassName="gap-3 px-4 py-4"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} />}>
        {canEdit ? <ModeSwitch onEdit={onEditMap} /> : null}
        <LayerPicker layer={layer} onChange={(next) => onViewChange({ layer: next })} />
        {layer === 'payments' ? (
          <MonthPicker
            month={month}
            shown={month || data?.month || ''}
            onChange={(next) => onViewChange({ month: next })}
          />
        ) : null}
        {NOTE[layer] ? (
          <Text className="text-xs leading-5 text-muted-foreground">{NOTE[layer]}</Text>
        ) : null}

        {error ? (
          <View className="gap-2">
            <ErrorBlock
              message={
                stale ||
                `Chưa tải được tình trạng phòng và thu tiền${month ? ` (${monthLabel(month)})` : ''}. Sơ đồ vẫn dùng được. ${error}`
              }
              busy={loading}
              onRetry={changed}
            />
            {/* The money layer already has this button in its month picker. */}
            {!data && month && layer !== 'payments' ? (
              <ActionButton
                label="Về tháng hiện tại"
                variant="secondary"
                className="min-h-[48px]"
                onClick={() => onViewChange({ month: '' })}
              />
            ) : null}
          </View>
        ) : null}
        {!ready ? (
          <View
            accessibilityRole="alert"
            className="rounded-xl border border-warning bg-warning-soft p-3">
            <Text className="text-sm leading-5 text-warning">
              Máy chủ chưa có dữ liệu cho lớp {LAYER_LABEL[layer]}. Lớp Phòng và Thu tiền vẫn dùng
              được.
            </Text>
          </View>
        ) : null}

        <SearchBox value={query} onChange={setQuery} />

        {waiting ? (
          <LoadingBlock label="Đang tải tình trạng phòng…" />
        ) : data && ready ? (
          <Legend
            layer={layer}
            leaseStatus={leaseStatus}
            items={legendItems(layer, counts, highlight)}
            highlight={highlight}
            onToggle={(status) => setPicked(status === highlight ? null : { layer, status })}
          />
        ) : null}

        {filtering ? (
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text
              accessibilityLiveRegion="polite"
              className="shrink text-sm font-bold text-foreground">
              {matched.size ? `Làm nổi ${matched.size} phòng.` : 'Không có phòng nào khớp.'}
            </Text>
            <ActionButton
              label="Bỏ làm nổi"
              variant="secondary"
              className="min-h-[48px]"
              onClick={() => {
                setQuery('');
                setPicked(null);
              }}
            />
          </View>
        ) : null}

        {floors.length > 1 ? (
          <FloorPicker
            floors={floors}
            current={floor}
            matches={filtering ? perFloor : null}
            onChange={(next) => onViewChange({ floorId: next.id ?? null })}
          />
        ) : null}
        {elsewhere ? (
          <ActionButton
            label={`Xem ${elsewhere.label} (${perFloor.get(elsewhere.key)} phòng khớp)`}
            variant="secondary"
            icon="arrow-forward"
            className="min-h-[48px]"
            onClick={() => onViewChange({ floorId: elsewhere.id ?? null })}
          />
        ) : null}

        <FloorBoard
          floor={floor}
          content={cellContent}
          filtering={filtering}
          matched={matched}
          flagged={flagged}
          onOpen={(slot) => setOpenKey(slot.key)}
        />

        {data && unplaced.length > 0 ? (
          <View className="gap-2">
            <View>
              <Text accessibilityRole="header" className="text-base font-bold text-foreground">
                Khoản thu chưa xếp phòng ({unplaced.length})
              </Text>
              <Text className="text-xs leading-5 text-muted-foreground">
                {monthLabel(data.month)} và nợ cũ
              </Text>
            </View>
            <EntryList entries={unplaced} onOpen={openTarget} />
          </View>
        ) : null}

        {renderTray(changed)}
      </ScrollView>

      {open ? (
        <RoomSheet
          title={`Phòng ${open.code} · ${open.floor.label}, ${open.row.label}`}
          layer={layer}
          cell={cellContent(open.slot)}
          entries={data && openRoom ? layerEntries(openRoom, layer, data, elapsed) : null}
          stale={stale || (!data ? error : '')}
          onOpen={openTarget}
          onClose={() => setOpenKey(null)}>
          {renderRoomLinks({ roomId: open.id, code: open.code }, changed)}
        </RoomSheet>
      ) : null}
    </>
  );
}
