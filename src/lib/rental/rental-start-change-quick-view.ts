// Port of hs-web-app lib/rental-start-change-quick-view.ts (Hermes-safe Vietnam-time formatting from ./format).
import { vnDateKey, vnDateTime } from '@/lib/rental/format';
import type {
  RentalOnboarding,
  RentalStartChange,
} from '@/services/rental/rental-onboarding.service';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

export const startChangeStatus: Record<RentalStartChange['status'], string> = {
  REQUESTED: 'Chờ chủ nhà duyệt',
  APPROVED: 'Đã đồng ý',
  REJECTED: 'Không đồng ý',
  WITHDRAWN: 'Đã rút',
  EXPIRED: 'Đã hết hạn',
};
export const calendarDate = (value: string) => value.split('T')[0].split('-').reverse().join('/');
export const vietnamTime = (value: string) => vnDateTime(value);

/**
 * Date bounds of an earlier-start request, shared by the quick modal and the onboarding panel:
 * not before today (Vietnam time, from the server clock) and strictly before the current start date.
 * Display only; the server validates.
 */
export function earlierStartBounds(view: Pick<RentalOnboarding, 'serverNow' | 'startsOn'>) {
  const min = vnDateKey(view.serverNow);
  const max = new Date(Date.parse(view.startsOn + 'T00:00:00Z') - 86400000)
    .toISOString()
    .slice(0, 10);
  return { min, max };
}
export const isValidEarlierStart = (
  startsOn: string,
  reason: string,
  view: Pick<RentalOnboarding, 'serverNow' | 'startsOn'>
) => {
  const { min, max } = earlierStartBounds(view);
  return !!startsOn && startsOn >= min && startsOn <= max && reason.trim().length >= 10;
};

/** View-only rule (the server already scoped the view to the viewer): used where the request row is not at hand. */
export function canHandleStartChangeView(
  view: RentalOnboarding,
  change: RentalStartChange,
  mode: 'RECEIVED' | 'SENT'
) {
  return (
    change.status === 'REQUESTED' &&
    !view.cancellationRequestedAt &&
    ![
      'PENDING',
      'CANCELLATION_REQUESTED',
      'COMPLETED',
      'CANCELLED_BY_SYSTEM',
      'CANCELLED_BY_OWNER',
      'CANCELLED_BY_RENTER',
      'EXPIRED',
      'REJECTED',
    ].includes(view.stage) &&
    new Date(view.serverNow).getTime() < new Date(change.respondBy).getTime() &&
    view.askerRole === (mode === 'RECEIVED' ? 'LANDLORD' : 'TENANT')
  );
}
export function canHandleStartChange(
  request: RentalRequestResponse,
  view: RentalOnboarding,
  change: RentalStartChange,
  actorId: string | null,
  mode: 'RECEIVED' | 'SENT'
) {
  return (
    request.status === 'ACCEPTED' &&
    canHandleStartChangeView(view, change, mode) &&
    (mode === 'RECEIVED' ? actorId === request.ownerId : actorId === request.renterId)
  );
}
