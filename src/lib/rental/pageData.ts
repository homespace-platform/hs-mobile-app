// Port of hs-web-app components/contract/page/pageData.ts (verbatim; only import paths changed).
import { createContext, useContext } from 'react';
import type { ContractLifecycle } from '@/types/rental/contract-lifecycle.type';
import type { DetailTab } from '@/lib/rental/rental-labels';

/** Data the page loads once for the next-step card, shared with the tabs so they do not fetch it again. */
export interface PageData {
  lifecycle: ContractLifecycle | null;
  setTab: (tab: DetailTab) => void;
  /** Switch tab, then scroll to the element with this id once the tab has rendered. */
  goTo: (tab: DetailTab, elementId: string) => void;
  available: DetailTab[];
}
export const PageDataContext = createContext<PageData>({
  lifecycle: null,
  setTab: () => {},
  goTo: () => {},
  available: ['overview'],
});
export const usePageData = () => useContext(PageDataContext);
