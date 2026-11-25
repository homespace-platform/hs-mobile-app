import { dateKey } from '@/lib/appointment-calendar';

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
