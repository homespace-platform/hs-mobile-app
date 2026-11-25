export type PageItem = number | 'ellipsis';

/** Compact page list for large totals, e.g. 1 … 4 5 6 … 30. Same algorithm as hs-web-app/lib/pagination.ts. */
export function getVisiblePages(current: number, total: number, siblingCount = 1): PageItem[] {
  if (total <= 0) return [];
  if (total === 1) return [1];

  const safeCurrent = Math.min(Math.max(current, 1), total);

  if (total <= siblingCount * 2 + 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(safeCurrent - siblingCount, 1);
  const rightSibling = Math.min(safeCurrent + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  const pages: PageItem[] = [1];

  if (showLeftEllipsis) {
    pages.push('ellipsis');
  } else {
    for (let page = 2; page < leftSibling; page += 1) pages.push(page);
  }

  for (let page = leftSibling; page <= rightSibling; page += 1) {
    if (page !== 1 && page !== total) pages.push(page);
  }

  if (showRightEllipsis) {
    pages.push('ellipsis');
  } else {
    for (let page = rightSibling + 1; page < total; page += 1) pages.push(page);
  }

  pages.push(total);
  return pages;
}

/** "Hiển thị a - b trong tổng số n ..." range for a 1-based page. */
export function pageRange(page: number, pageSize: number, shown: number, totalItems: number) {
  const start = (page - 1) * pageSize;
  return { from: Math.min(start + 1, totalItems), to: Math.min(start + shown, totalItems) };
}
