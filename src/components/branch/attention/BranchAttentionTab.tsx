// OWNER: agent A. "Cần chú ý" of one branch (web BranchAttentionList). It is mounted only while its
// tab is shown, so coming back always reads again and handled work disappears. Items, order,
// priority, counts and deadlines are the server's. Design: docs/chi-nhanh/00-thiet-ke.md section 8.
// The props are final.
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { ErrorBlock, LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { pageCount } from '@/lib/branch-assignment';
import { branchError } from '@/lib/branch-error';
import type { BranchNav } from '@/lib/branch-nav';
import type { BranchAttention } from '@/lib/branch-overview';
import { useBranchRead, useNowMs } from '@/lib/use-branch-read';
import { branchOverviewApi } from '@/services/branchMonitorApi';

import WorkCard from './WorkCard';

export interface BranchAttentionTabProps {
  branchId: string;
  nav: BranchNav;
  /** Report each successful read: the shell takes the tab's count from it. Stable between renders. */
  onCountChange: (read: BranchAttention) => void;
}

const describe = (error: unknown) => branchError(error, 'Máy chủ chưa trả lời được.');

export default function BranchAttentionTab({
  branchId,
  nav,
  onCountChange,
}: BranchAttentionTabProps) {
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const load = useCallback(() => branchOverviewApi.getAttention(branchId, page), [branchId, page]);
  const { data, error, at, loading, reload } = useBranchRead(load, describe);
  // Countdowns start from the server's clock and move with the time passed since the answer arrived.
  const now = useNowMs();
  const pages = data ? pageCount(data) : 1;
  // Work done elsewhere can empty the last page: step back while rendering.
  if (data && page >= pages) setPage(pages - 1);
  useEffect(() => {
    if (data) onCountChange(data);
  }, [data, onCountChange]);

  const goTo = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <ScrollView
      ref={scroll}
      contentContainerClassName="gap-3 px-4 pb-10 pt-4"
      refreshControl={
        <RefreshControl refreshing={loading && !!data} onRefresh={() => void reload()} />
      }>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text accessibilityRole="header" className="shrink text-lg font-bold text-foreground">
          Cần chú ý{data ? ` (${data.totalElements})` : ''}
        </Text>
        <ActionButton
          label="Làm mới"
          variant="secondary"
          icon="refresh"
          busy={loading}
          onClick={() => void reload()}
          className="min-h-[48px]"
        />
      </View>
      <Text className="text-sm leading-5 text-muted-foreground">
        Việc gấp ở trên. Bấm để mở đúng nơi xử lý; xử lý xong thì việc tự mất.
        {pages > 1 ? ` Danh sách có ${pages} trang, chuyển trang ở cuối.` : ''}
      </Text>

      {error ? (
        <ErrorBlock
          message={`${data ? 'Chưa tải lại được, danh sách có thể đã cũ.' : 'Chưa tải được danh sách việc. Các phần khác của chi nhánh vẫn dùng được.'} ${error}`}
          busy={loading}
          onRetry={() => void reload()}
        />
      ) : null}
      {/* A later page that cannot be read has no pager of its own. */}
      {!data && error && page > 0 ? (
        <ActionButton
          label="Về trang đầu"
          variant="secondary"
          onClick={() => goTo(0)}
          className="min-h-[48px]"
        />
      ) : null}
      {!data && !error ? <LoadingBlock label="Đang tải việc cần chú ý..." /> : null}

      {data?.totalElements === 0 ? (
        <View className="rounded-2xl border border-dashed border-border-strong bg-surface p-6">
          <Text className="text-center text-sm leading-6 text-muted-foreground">
            Không có việc nào cần chú ý.
          </Text>
        </View>
      ) : null}
      {data?.items.map((work) => (
        <WorkCard
          key={work.key}
          work={work}
          clocks={data}
          elapsedMs={now - at}
          onOpen={() => nav.openTarget(work.target)}
        />
      ))}

      {data && pages > 1 ? (
        <View className="gap-2 pt-1">
          <Text
            accessibilityLiveRegion="polite"
            className="text-center text-sm font-semibold text-foreground">
            Trang {page + 1}/{pages}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <ActionButton
              label="‹ Trước"
              hint="Trang việc trước"
              variant="secondary"
              disabled={loading || page <= 0}
              onClick={() => goTo(page - 1)}
              className="min-h-[48px] flex-1"
            />
            <ActionButton
              label="Sau ›"
              hint="Trang việc sau"
              variant="secondary"
              disabled={loading || page >= pages - 1}
              onClick={() => goTo(page + 1)}
              className="min-h-[48px] flex-1"
            />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
