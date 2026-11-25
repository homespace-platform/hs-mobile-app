// Port of the tab resolution in hs-web-app hooks/useDetailTab.ts (:17-18); the active tab lives in
// mobile route params instead of `?tab=`.
import { DETAIL_TABS, type DetailTab } from '@/lib/rental/rental-labels';

export function resolveDetailTab(
  raw: string | null | undefined,
  defaultTab: DetailTab = 'overview'
): DetailTab {
  return (DETAIL_TABS.some((t) => t.id === raw) ? raw : defaultTab) as DetailTab;
}
