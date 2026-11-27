// Branch detail on the phone: tabs "Sơ đồ" and "Cần chú ý". Shell only: it reads the saved map and
// wires the parts in components/branch/{view,editing,attention}.
import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BranchAttentionTab from '@/components/branch/attention/BranchAttentionTab';
import RoomLinksPanel from '@/components/branch/editing/RoomLinksPanel';
import UnplacedTray from '@/components/branch/editing/UnplacedTray';
import { createDraftSession } from '@/components/branch/editing/logic';
import { reloadTray } from '@/components/branch/editing/useLinkAction';
import BranchMapView from '@/components/branch/view/BranchMapView';
import ActionButton from '@/components/rental/shared/ActionButton';
import { useViewer } from '@/components/rental/requests/useViewer';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { ErrorNotice, ScreenHeader } from '@/components/Screen';
import { roomOptions } from '@/lib/branch-assignment';
import { branchError } from '@/lib/branch-error';
import { fromLayout } from '@/lib/branch-layout';
import { loadBranchLayout, recodeSavedRoom } from '@/lib/branch-layout-save';
import type { BranchNav, BranchViewState } from '@/lib/branch-nav';
import type { BranchAttention } from '@/lib/branch-overview';
import { PERMISSIONS } from '@/lib/permissions';
import { useBranchRead } from '@/lib/use-branch-read';
import { useFeatureGate } from '@/lib/use-feature-gate';
import type { Branch } from '@/services/branchApi';
import { branchDraftStore } from '@/services/branchDraftStore';
import { branchLayoutApi } from '@/services/branchMonitorApi';

export interface BranchDetailState {
  tab: 'map' | 'attention';
  view: BranchViewState;
  trayOpen: boolean;
}

export const initialBranchDetail = (tab: BranchDetailState['tab'] = 'map'): BranchDetailState => ({
  tab,
  view: { floorId: null, layer: 'rooms', month: '' },
  trayOpen: false,
});

type Update = (change: (current: BranchDetailState) => BranchDetailState) => void;

type Props = {
  branch: Branch;
  state: BranchDetailState;
  onStateChange: Update;
  nav: BranchNav;
  onEditMap: () => void;
};

const describeLayoutError = (error: unknown) => branchError(error, 'Chưa tải được sơ đồ.');

function MapTab({ branch, state, onStateChange, nav, onEditMap }: Props) {
  const gate = useFeatureGate(PERMISSIONS.LISTING_POST);
  const isHouse = branch.category === 'HOUSE';
  const createHouse = isHouse && gate.allowed;
  const load = useCallback(
    () => loadBranchLayout(branchLayoutApi, branch.id, createHouse),
    [branch.id, createHouse]
  );
  const { data, error, loading, reload } = useBranchRead(load, describeLayoutError);
  const floors = useMemo(() => (data ? fromLayout(data.layout) : []), [data]);
  const rooms = useMemo(() => roomOptions(floors), [floors]);
  const links = { branchId: branch.id, canEdit: gate.allowed, lockMessage: gate.title, nav };
  const { userId } = useViewer();
  /** "Đổi mã ô thành <mã tin>": the normal layout save; rejects with the reason when it cannot. */
  const recode = async (roomId: string, code: string) => {
    if (!data) throw new Error('Sơ đồ chưa tải xong.');
    if (!userId) throw new Error('Chưa xác định được tài khoản. Hãy thử lại sau giây lát.');
    const { layout } = data;
    const session = createDraftSession(branchDraftStore, userId, branch.id);
    const outcome = await recodeSavedRoom(
      branchLayoutApi,
      branch.id,
      layout,
      roomId,
      code,
      async () => (await session.open(layout)) !== null
    );
    if (outcome.kind === 'saved') return void (await reload());
    if (outcome.kind === 'conflict') {
      await reload();
      throw new Error('Sơ đồ đã được thay đổi ở nơi khác. Đã tải lại sơ đồ, hãy thử lại.');
    }
    throw new Error(outcome.message);
  };
  const renderTray = (onChanged: () => void) => (
    <UnplacedTray
      {...links}
      rooms={rooms}
      open={state.trayOpen}
      onOpenChange={(trayOpen) => onStateChange((current) => ({ ...current, trayOpen }))}
      onChanged={onChanged}
    />
  );

  if (!data)
    return (
      <View className="px-4 py-4">
        {error ? (
          <ErrorBlock message={error} busy={loading} onRetry={() => void reload()} />
        ) : (
          <LoadingBlock label="Đang tải sơ đồ..." />
        )}
      </View>
    );

  const stale = error ? `Chưa tải lại được, sơ đồ có thể đã cũ. ${error}` : null;
  if (floors.length === 0)
    return (
      <ScrollView
        contentContainerClassName="gap-4 px-4 py-4"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void Promise.all([reload(), reloadTray()])}
          />
        }>
        <ErrorNotice message={stale} />
        <View className="gap-2 rounded-2xl border border-dashed border-border-strong bg-surface p-4">
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            Chi nhánh chưa có sơ đồ phòng
          </Text>
          <Text className="text-sm leading-6 text-muted-foreground">
            {isHouse
              ? 'Sơ đồ một ô của nhà nguyên căn được tạo tự động.'
              : 'Tạo sơ đồ để thấy phòng nào đang trống, cần thu tiền hay sắp hết hợp đồng.'}
          </Text>
          {!gate.allowed ? (
            <Text className="text-sm leading-6 text-warning">{gate.title}</Text>
          ) : isHouse ? (
            <>
              <ErrorNotice message={data.houseError || null} />
              <ActionButton label="Thử lại" busy={loading} onClick={() => void reload()} />
            </>
          ) : (
            <ActionButton label="Tạo sơ đồ phòng" onClick={onEditMap} />
          )}
        </View>
        {renderTray(() => void reload())}
      </ScrollView>
    );

  return (
    <View className="flex-1">
      {stale ? (
        <View className="px-4">
          <ErrorNotice message={stale} />
        </View>
      ) : null}
      <BranchMapView
        branchId={branch.id}
        floors={floors}
        view={state.view}
        onViewChange={(patch) =>
          onStateChange((current) => ({ ...current, view: { ...current.view, ...patch } }))
        }
        nav={nav}
        canEdit={gate.allowed}
        onEditMap={onEditMap}
        onRefreshLayout={reload}
        renderRoomLinks={(room, onChanged) => (
          <RoomLinksPanel
            {...links}
            key={room.roomId}
            roomId={room.roomId}
            code={room.code}
            rooms={rooms}
            onChanged={onChanged}
            onRecode={recode}
          />
        )}
        renderTray={renderTray}
      />
    </View>
  );
}

export default function BranchDetailScreen({
  attentionCount,
  onAttentionCount,
  onBack,
  onOpenInfo,
  ...props
}: Props & {
  attentionCount?: number;
  onAttentionCount: (read: BranchAttention) => void;
  onBack: () => void;
  /** Address, fees, rules, edit and delete. */
  onOpenInfo: () => void;
}) {
  const { branch, state, onStateChange, nav } = props;
  const tabs = [
    { id: 'map', label: 'Sơ đồ' },
    { id: 'attention', label: 'Cần chú ý' + (attentionCount ? ` (${attentionCount})` : '') },
  ] as const;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader
        title={branch.name}
        onBack={onBack}
        right={
          <Pressable
            onPress={onOpenInfo}
            accessibilityRole="button"
            accessibilityLabel="Thông tin chi nhánh"
            className="ml-2 min-h-[48px] min-w-[48px] items-center justify-center">
            <Text className="text-sm font-bold text-primary">Thông tin</Text>
          </Pressable>
        }
      />
      <View accessibilityRole="tablist" className="flex-row border-b border-border bg-surface">
        {tabs.map((tab) => {
          const selected = state.tab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onStateChange((current) => ({ ...current, tab: tab.id }))}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={`min-h-[48px] flex-1 items-center justify-center border-b-2 px-2 py-2 ${selected ? 'border-primary' : 'border-transparent'}`}>
              <Text
                className={`text-center text-sm font-bold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {state.tab === 'attention' ? (
        <BranchAttentionTab branchId={branch.id} nav={nav} onCountChange={onAttentionCount} />
      ) : (
        <MapTab {...props} />
      )}
    </SafeAreaView>
  );
}
