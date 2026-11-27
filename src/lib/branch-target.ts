/**
 * Server `href` (design 07 §6) -> mobile destination; null = no mobile screen, the caller says so.
 * Pure (node tests). Table: docs/chi-nhanh/00-thiet-ke.md §4. It decides by href, never by target.kind.
 */
import type { BranchDestination } from '@/lib/branch-nav';
import { getSafeActionPath } from '@/lib/notification';
import { safeResourceId } from '@/lib/rental/payment-module';
import { rentalRouteFromActionPath } from '@/lib/rental-nav/deep-link';

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // The bad text stays and fails the id check.
  }
}

/** What a card says about its link: no screen on the phone, or where to look on the opened one. */
export function targetNote(href: string | null): { opens: boolean; note: string | null } {
  if (!href || !branchDestination(href))
    return { opens: false, note: 'Chưa mở được trên điện thoại. Hãy xử lý trên web.' };
  // Mobile opens these on the "Hủy / kết thúc" tab without scrolling to the item (design 00 §4).
  const block = /[?&]amendmentId=/.test(href)
    ? 'Phụ lục / điều chỉnh'
    : /[?&]focus=early-exit(&|#|$)/.test(href)
      ? 'Kết thúc sớm / trả nhà'
      : null;
  return { opens: true, note: block && `Ở thẻ Hủy / kết thúc, kéo đến mục ${block}.` };
}

export function branchDestination(href: string): BranchDestination | null {
  const safe = getSafeActionPath(href);
  if (!safe?.startsWith('/dashboard/')) return null;
  const [beforeHash, hash] = safe.split('#');
  const [pathname, query = ''] = beforeHash.split('?');
  const param = (name: string) => {
    const pair = query.split('&').find((part) => part.split('=')[0] === name);
    return pair ? decode(pair.slice(name.length + 1)) : '';
  };
  const [, area, a, extra] = pathname.split('/').filter(Boolean);

  if (area === 'properties') {
    if (extra !== undefined) return null;
    if (a === 'view') {
      const listingId = safeResourceId(param('id'));
      return listingId ? { kind: 'listing', listingId } : null;
    }
    if (a === 'new') {
      const branchId = safeResourceId(param('branchId'));
      const roomId = safeResourceId(param('roomId'));
      return branchId && roomId ? { kind: 'new-listing', branchId, roomId } : null;
    }
    return null;
  }
  if (area === 'viewing-schedules') {
    const appointmentId = a === undefined ? safeResourceId(param('appointmentId')) : null;
    return appointmentId ? { kind: 'appointment', appointmentId } : null;
  }
  if (area === 'branches') {
    // Only the "Chưa xếp phòng" tray; a plain branch link is not something to act on.
    const branchId = extra === undefined && a ? safeResourceId(decode(a)) : null;
    return branchId && hash === 'unplaced' && param('tab') === 'map'
      ? { kind: 'tray', branchId }
      : null;
  }

  const route = rentalRouteFromActionPath(safe, 'landlord');
  if (!route) return null;
  // One tap from the branch to the transfer's buttons (the web /dashboard/payments card).
  return {
    kind: 'rental',
    route: route.screen === 'payment-lookup' ? { ...route, actHere: true } : route,
  };
}
