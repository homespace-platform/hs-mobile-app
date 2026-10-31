export type CalendarView = 'month' | 'week';

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarDays(anchor: Date, view: CalendarView) {
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    view === 'month' ? 1 : anchor.getDate()
  );
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end =
    view === 'week' ? new Date(start) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  end.setDate(end.getDate() + (view === 'week' ? 6 : 6 - ((end.getDay() + 6) % 7)));
  const days: Date[] = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1))
    days.push(new Date(day));
  return days;
}

export function moveCalendar(anchor: Date, view: CalendarView, amount: number) {
  return view === 'month'
    ? new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1)
    : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * amount);
}
