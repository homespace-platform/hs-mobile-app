import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';

export type CalendarView = 'month' | 'week';
export type AppointmentCalendarView = CalendarView;

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

// Same as hs-web-app lib/appointment-calendar.ts.
export function getAppointmentCalendarDays(anchorDate: Date, view: CalendarView): Date[] {
  const rangeStart =
    view === 'month'
      ? startOfWeek(startOfMonth(anchorDate), WEEK_OPTIONS)
      : startOfWeek(anchorDate, WEEK_OPTIONS);
  const rangeEnd =
    view === 'month'
      ? endOfWeek(endOfMonth(anchorDate), WEEK_OPTIONS)
      : endOfWeek(anchorDate, WEEK_OPTIONS);

  return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
}

export const calendarDays = getAppointmentCalendarDays;

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Older screens only: a month step lands on day 1. The web port uses shiftCalendar (lib/appointment). */
export function moveCalendar(anchor: Date, view: CalendarView, amount: number) {
  return view === 'month'
    ? new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1)
    : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * amount);
}
