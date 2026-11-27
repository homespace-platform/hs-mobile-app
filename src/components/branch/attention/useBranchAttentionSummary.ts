// OWNER: agent A. Work counts of every branch for the list cards and the tab badge, in the server's
// order (most urgent first). A failed read keeps the last answer; the shell keeps listing branches.
// The returned shape is final; `reload` must be stable (the shell calls it from an effect).
import { branchError } from '@/lib/branch-error';
import type { AttentionSummary } from '@/lib/branch-overview';
import { useBranchRead } from '@/lib/use-branch-read';
import { branchOverviewApi } from '@/services/branchMonitorApi';

export interface BranchAttentionSummaryState {
  /** null = not read yet, or never succeeded: the list keeps its own order and shows no count. */
  data: AttentionSummary | null;
  error: string;
  loading: boolean;
  reload: () => Promise<void>;
}

const describe = (error: unknown) => branchError(error, 'Máy chủ chưa trả lời được.');

export function useBranchAttentionSummary(): BranchAttentionSummaryState {
  const { data, error, loading, reload } = useBranchRead(
    branchOverviewApi.getAttentionSummary,
    describe
  );
  return { data, error, loading, reload };
}
