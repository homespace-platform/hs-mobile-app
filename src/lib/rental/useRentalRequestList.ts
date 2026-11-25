// Port of the pure parts of hs-web-app components/rental-request/useRentalRequestList.ts. The React state
// stays in the screen; the service is passed in so this file has no network imports.
import type {
  RentalRequestResponse,
  RentalRequestStatus,
} from '@/types/rental/rental-request.type';
import type { PageResponse } from '@/types/api';

export type RequestFilter = RentalRequestStatus | 'ALL' | 'CANCELLED';
export const CANCELLED_STATUSES: RentalRequestStatus[] = [
  'CANCELLED_BY_RENTER',
  'CANCELLED_BY_OWNER',
  'CANCELLED_BY_SYSTEM',
];
export const PAGE_SIZE = 8;
export const LIST_LOAD_ERROR = 'Không thể tải danh sách yêu cầu thuê nhà.';

type PageQuery = { status: RentalRequestStatus | 'ALL'; page: number; size: number };
type PageResult = Pick<
  PageResponse<RentalRequestResponse>,
  'result' | 'totalElements' | 'totalPages'
>;
export interface RequestListApi {
  getMyRequests(query: PageQuery): Promise<PageResult>;
  getOwnerRequests(query: PageQuery): Promise<PageResult>;
}

/**
 * The server filters by ONE status, so "Đã hủy" (three statuses) asks for each of them and merges: for page p every
 * source only needs its newest p*size rows to produce the newest p*size of the union.
 */
export async function loadPage(
  api: RequestListApi,
  mode: 'RECEIVED' | 'SENT',
  filter: RequestFilter,
  page: number
) {
  const fetchPage = (status: RentalRequestStatus | 'ALL', pageNo: number, size: number) =>
    mode === 'SENT'
      ? api.getMyRequests({ status, page: pageNo, size })
      : api.getOwnerRequests({ status, page: pageNo, size });
  if (filter !== 'CANCELLED') {
    const res = await fetchPage(filter, page, PAGE_SIZE);
    return {
      rows: res.result || [],
      totalElements: res.totalElements || 0,
      totalPages: res.totalPages || 1,
    };
  }
  const parts = await Promise.all(
    CANCELLED_STATUSES.map((status) => fetchPage(status, 1, page * PAGE_SIZE))
  );
  const merged = parts
    .flatMap((part) => part.result || [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = parts.reduce((sum, part) => sum + (part.totalElements || 0), 0);
  return {
    rows: merged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/**
 * Ticketed loads (:33-65). A result applies only if no newer foreground load started (filter/page change) and
 * nothing newer already applied, so an old foreground can't overwrite a fresher silent result. Keep one instance
 * per screen (useRef). Per load: `const t = tickets.start(silent)`, then `if (!t.isCurrent()) return;
 * t.markApplied();` before setting rows; show the error toast only for a non-silent current ticket; clear the
 * spinner only when `t.ownsSpinner()`. Keep the previous array when JSON.stringify of the rows is unchanged.
 */
export function createListTickets() {
  let latest = 0;
  let foreground = 0;
  let applied = 0;
  return {
    start(silent: boolean) {
      const sequence = ++latest;
      if (!silent) foreground = sequence;
      return {
        isCurrent: () => sequence >= foreground && sequence > applied,
        markApplied: () => {
          applied = sequence;
        },
        // The spinner belongs to the latest foreground load, even if a silent result superseded its data.
        ownsSpinner: () => !silent && sequence === foreground,
      };
    },
  };
}
