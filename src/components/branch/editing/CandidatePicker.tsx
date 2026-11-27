// Port of hs-web-app components/branch/CandidatePicker.tsx: existing listings or lease contracts that
// can be put in `roomId` (null = the tray). Drawn in place, never in its own Modal. The server only
// pages, so every page is read once (capped) and search, "same code first" and paging happen here.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { LoadingBlock, ErrorBlock } from '@/components/rental/shared/StateBlocks';
import {
  MAX_CANDIDATE_PAGES,
  PAGE_SIZE,
  candidateCodeNote,
  candidateState,
  loadAllCandidates,
  sortCandidates,
} from '@/lib/branch-assignment';
import { branchError } from '@/lib/branch-error';
import { useBranchRead } from '@/lib/use-branch-read';
import { branchAssignmentApi } from '@/services/branchMonitorApi';
import type { AssignmentCandidate, AssignmentKind, RoomOption } from '@/types/branch-assignment';

import { matchesText } from './logic';
import { Empty, Input, Pager, Row } from './ui';

export default function CandidatePicker({
  branchId,
  kind,
  roomId,
  cellCode,
  rooms,
  trayIds,
  disabled,
  onPick,
}: {
  branchId: string;
  kind: AssignmentKind;
  roomId: string | null;
  /** Code of the cell the pick goes to; listings with the same code are listed first. */
  cellCode?: string | null;
  rooms: RoomOption[];
  trayIds?: Set<string>;
  disabled: boolean;
  /** Resolves true when the write succeeded; on failure the list is read again. */
  onPick: (candidate: AssignmentCandidate) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const noun = kind === 'CONTRACT' ? 'hợp đồng' : 'tin đăng';
  const load = useCallback(
    () => loadAllCandidates((index) => branchAssignmentApi.getCandidates(branchId, kind, index)),
    [branchId, kind]
  );
  const describe = useCallback(
    (error: unknown) => branchError(error, `Chưa tải được danh sách ${noun}.`),
    [noun]
  );
  const { data, error, loading, reload } = useBranchRead(load, describe);

  const shown = useMemo(() => {
    const items = kind === 'LISTING' ? sortCandidates(data?.items ?? [], cellCode) : (data?.items ?? []);
    return items.filter((item) => matchesText(`${item.label} ${item.roomCode ?? ''}`, query));
  }, [data, kind, cellCode, query]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);

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
      {data && data.items.length > 0 ? (
        <Input
          label={kind === 'LISTING' ? 'Tìm tên tin hoặc mã phòng' : 'Tìm hợp đồng'}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setPage(0);
          }}
          placeholder={kind === 'LISTING' ? 'Tên tin, mã phòng…' : 'Tên, mã hợp đồng…'}
        />
      ) : null}
      {data && data.total > MAX_CANDIDATE_PAGES * PAGE_SIZE ? (
        <Text className="text-xs leading-5 text-warning">
          Chỉ hiện {data.items.length} trong {data.total} mục đầu tiên của máy chủ.
        </Text>
      ) : null}
      {data && data.items.length > 0 && shown.length === 0 ? (
        <Empty text={`Không có ${noun} nào khớp "${query.trim()}".`} />
      ) : null}
      {shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item) => {
        const state = candidateState(kind, item, roomId, rooms, trayIds?.has(item.id));
        const code = kind === 'LISTING' ? candidateCodeNote(cellCode, item.roomCode) : '';
        const detail = [code, state.note].filter(Boolean).join(' ');
        return (
          <Row
            key={item.id}
            title={item.label}
            detail={detail || undefined}
            trailing={state.action}
            disabled={disabled || state.disabled}
            accessibilityLabel={`${state.action} ${noun} ${item.label}. ${detail}`}
            onPress={() =>
              void onPick(item).then((ok) => {
                if (!ok) void reload();
              })
            }
          />
        );
      })}
      {data ? <Pager page={page} pages={pages} disabled={loading || disabled} onPage={setPage} /> : null}
    </View>
  );
}
