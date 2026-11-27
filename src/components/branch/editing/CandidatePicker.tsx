// Port of hs-web-app components/branch/CandidatePicker.tsx: one page of existing listings or lease
// contracts that can be put in `roomId` (null = the tray). Drawn in place, never in its own Modal.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { LoadingBlock, ErrorBlock } from '@/components/rental/shared/StateBlocks';
import { candidateState, pageCount } from '@/lib/branch-assignment';
import { branchError } from '@/lib/branch-error';
import { useBranchRead } from '@/lib/use-branch-read';
import { branchAssignmentApi } from '@/services/branchMonitorApi';
import type { AssignmentCandidate, AssignmentKind, RoomOption } from '@/types/branch-assignment';

import { Empty, Pager, Row } from './ui';

export default function CandidatePicker({
  branchId,
  kind,
  roomId,
  rooms,
  trayIds,
  disabled,
  onPick,
}: {
  branchId: string;
  kind: AssignmentKind;
  roomId: string | null;
  rooms: RoomOption[];
  trayIds?: Set<string>;
  disabled: boolean;
  /** Resolves true when the write succeeded; on failure the list is read again. */
  onPick: (candidate: AssignmentCandidate) => Promise<boolean>;
}) {
  const [page, setPage] = useState(0);
  const noun = kind === 'CONTRACT' ? 'hợp đồng' : 'tin đăng';
  const load = useCallback(
    () => branchAssignmentApi.getCandidates(branchId, kind, page),
    [branchId, kind, page]
  );
  const describe = useCallback(
    (error: unknown) => branchError(error, `Chưa tải được danh sách ${noun}.`),
    [noun]
  );
  const { data, error, loading, reload } = useBranchRead(load, describe);

  const last = data ? pageCount(data) - 1 : null;
  useEffect(() => {
    if (last !== null && page > last) setPage(last);
  }, [page, last]);

  return (
    <View className="gap-3">
      {error ? <ErrorBlock message={error} busy={loading} onRetry={() => void reload()} /> : null}
      {!data && !error ? <LoadingBlock label="Đang tải..." /> : null}
      {data && data.items.length === 0 ? (
        <Empty
          text={
            kind === 'CONTRACT'
              ? 'Không có hợp đồng thuê nào để chọn.'
              : 'Chưa có tin nào thuộc chi nhánh này. Muốn dùng tin ở nơi khác, hãy đổi chi nhánh trong trang sửa tin ở menu Tin đăng.'
          }
        />
      ) : null}
      {data?.items.map((item) => {
        const state = candidateState(kind, item, roomId, rooms, trayIds?.has(item.id));
        return (
          <Row
            key={item.id}
            title={item.label}
            detail={state.note || undefined}
            trailing={state.action}
            disabled={disabled || state.disabled}
            accessibilityLabel={`${state.action} ${noun} ${item.label}. ${state.note}`}
            onPress={() =>
              void onPick(item).then((ok) => {
                if (!ok) void reload();
              })
            }
          />
        );
      })}
      {data ? (
        <Pager
          page={page}
          pages={pageCount(data)}
          disabled={loading || disabled}
          onPage={setPage}
        />
      ) : null}
    </View>
  );
}
