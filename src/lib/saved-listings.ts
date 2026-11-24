import type { ListingSummary } from '@/services/listingApi';

// Same paging, filtering and sorting as web app/favorites and app/history (client side).
export const SAVED_PAGE_SIZE = 8;

export type SavedSort = 'recent' | 'price_asc' | 'price_desc' | 'area_desc';
export type SavedCategory = 'HOUSE' | 'APARTMENT' | 'ROOM';

// Web toRentProperty maps every category that is not HOUSE/APARTMENT to "room".
function savedCategory(category: string): SavedCategory {
  return category === 'HOUSE' || category === 'APARTMENT' ? category : 'ROOM';
}

export function categoryCounts(rows: ListingSummary[]) {
  const counts = { all: rows.length, HOUSE: 0, APARTMENT: 0, ROOM: 0 };
  for (const row of rows) counts[savedCategory(row.category)] += 1;
  return counts;
}

export function filterSavedListings(
  rows: ListingSummary[],
  { category, query, sort }: { category?: string; query?: string; sort: SavedSort }
) {
  const q = (query ?? '').trim().toLowerCase();
  const result = rows.filter(
    (row) =>
      (!category || savedCategory(row.category) === category) &&
      (!q ||
        [row.title, row.fullAddress, row.provinceName].some((text) =>
          (text ?? '').toLowerCase().includes(q)
        ))
  );
  // Array.sort is stable, so "recent" keeps the server order (newest first).
  return result.sort((a, b) => {
    if (sort === 'price_asc') return a.priceAmount - b.priceAmount;
    if (sort === 'price_desc') return b.priceAmount - a.priceAmount;
    if (sort === 'area_desc') return b.areaM2 - a.areaM2;
    return 0;
  });
}

// `start`/`end` are zero-based slice bounds; the UI shows `start + 1 - end`.
export function pageWindow(total: number, page: number) {
  const totalPages = Math.ceil(total / SAVED_PAGE_SIZE) || 1;
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = (current - 1) * SAVED_PAGE_SIZE;
  return { page: current, totalPages, start, end: Math.min(start + SAVED_PAGE_SIZE, total) };
}
