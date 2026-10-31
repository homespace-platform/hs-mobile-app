import { dateKey } from '@/lib/appointment-calendar';
import type { Availability } from '@/services/bookingApi';

export const VIEWING_DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export function canSelectViewingDay(day: Date, minDate: string, allowedDays?: string[]) {
  return (
    dateKey(day) >= minDate &&
    (allowedDays === undefined || allowedDays.includes(VIEWING_DAYS[day.getDay()]))
  );
}

export function canBookSlot(
  data: Availability | null,
  slot: Availability['slots'][number] | null,
  rescheduling: boolean
) {
  return Boolean(
    data?.isDayAvailable &&
    slot &&
    (!data.hasExistingActiveBooking || rescheduling) &&
    data.slots.some(
      (item) =>
        item.startTime === slot.startTime &&
        item.endTime === slot.endTime &&
        item.status === 'AVAILABLE'
    )
  );
}

export function viewingPeriod(startTime: string) {
  const hour = Number(startTime.slice(0, 2));
  return hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING';
}
