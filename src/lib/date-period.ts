export type DatePeriod = 'ALL' | 'DAY' | 'WEEK' | 'MONTH';

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getDatePeriodRange(anchor: Date, period: DatePeriod) {
  if (period === 'ALL') return null;
  if (period === 'DAY') {
    const day = dateKey(anchor);
    return { start: day, end: day };
  }
  if (period === 'WEEK') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: dateKey(start), end: dateKey(end) };
  }
  return {
    start: dateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    end: dateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
  };
}

export function moveDatePeriod(anchor: Date, period: Exclude<DatePeriod, 'ALL'>, amount: number) {
  if (period === 'DAY') {
    const next = new Date(anchor);
    next.setDate(next.getDate() + amount);
    return next;
  }
  if (period === 'WEEK') {
    const next = new Date(anchor);
    next.setDate(next.getDate() + amount * 7);
    return next;
  }
  return new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1);
}

export function datePeriodLabel(start: string, end: string, period: Exclude<DatePeriod, 'ALL'>) {
  const format = (value: string) =>
    value.slice(8, 10) + '/' + value.slice(5, 7) + '/' + value.slice(0, 4);
  if (period === 'MONTH') {
    const date = new Date(`${start}T00:00:00`);
    return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  }
  return start === end ? format(start) : `${format(start)} – ${format(end)}`;
}

export function toLocalDateKey(value?: string | null) {
  if (!value) return null;
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateOnly) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateKey(date);
}
