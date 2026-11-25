// Pure port of the non-UI logic in hs-web-app components/appointment/* and the two
// viewing-schedules pages. No React Native imports. Icons are Ionicons names.
import { addDays, addMonths, addWeeks, format, getDay, isBefore, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale/vi';

import { getAppointmentCalendarDays, type CalendarView } from '@/lib/appointment-calendar';
import { PERMISSIONS, type PermissionCode } from '@/lib/permissions';
import type { PageResponse } from '@/types/api';
import type {
  AppointmentCancelledBy,
  AppointmentResponse,
  AppointmentStatus,
  AppointmentViewRole,
  AvailabilitySlot,
  CreateAppointmentRequest,
  RescheduleAppointmentRequest,
  ViewingSlot,
} from '@/types/appointment';

export { getAppointmentCalendarDays, type CalendarView };

// ---- Status ----

export type AppointmentTone = 'warning' | 'success' | 'danger' | 'neutral' | 'primary';

/** Semantic classes per tone (web: amber, emerald, rose, muted/zinc, blue). */
export const TONE_CLASSES: Record<AppointmentTone, { fill: string; text: string; border: string }> =
  {
    warning: { fill: 'bg-warning-soft', text: 'text-warning', border: 'border-warning' },
    success: { fill: 'bg-success-soft', text: 'text-success', border: 'border-success' },
    danger: { fill: 'bg-danger-soft', text: 'text-danger', border: 'border-danger' },
    neutral: { fill: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
    primary: { fill: 'bg-primary-soft', text: 'text-primary', border: 'border-primary-border' },
  };

export const APPOINTMENT_STATUS_META = {
  PENDING: { label: 'Chờ xác nhận', tone: 'warning', icon: 'time-outline' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success', icon: 'checkmark-circle-outline' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger', icon: 'close-circle-outline' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral', icon: 'close-circle-outline' },
  COMPLETED: { label: 'Đã hoàn thành', tone: 'primary', icon: 'calendar-outline' },
  EXPIRED: { label: 'Quá hạn', tone: 'neutral', icon: 'alert-circle-outline' },
} as const satisfies Record<
  AppointmentStatus,
  { label: string; tone: AppointmentTone; icon: string }
>;

export function getStatusMeta(status: string) {
  return APPOINTMENT_STATUS_META[status as AppointmentStatus] ?? APPOINTMENT_STATUS_META.PENDING;
}

/** PENDING or CONFIRMED: the renter cannot book the listing again. */
export function isActiveBooking(booking: { status: string } | null | undefined) {
  return Boolean(booking && ['PENDING', 'CONFIRMED'].includes(booking.status));
}

export const CANCELLED_BY_LABELS: Record<AppointmentCancelledBy, string> = {
  RENTER: 'Khách hàng hủy',
  OWNER: 'Chủ nhà hủy',
  SYSTEM: 'Hệ thống tự động hủy',
};

// ---- Slots ----

export const SLOT_TYPE_LABELS: Record<ViewingSlot, string> = {
  MORNING: 'Buổi sáng',
  AFTERNOON: 'Buổi chiều',
  EVENING: 'Buổi tối',
};

export const getSlotTypeLabel = (slot: string) => SLOT_TYPE_LABELS[slot as ViewingSlot] || slot;

export const SLOT_PERIODS = [
  { key: 'MORNING', label: 'Buổi sáng (08:00 – 12:00)', icon: 'sunny-outline' },
  { key: 'AFTERNOON', label: 'Buổi chiều (13:00 – 17:00)', icon: 'partly-sunny-outline' },
  { key: 'EVENING', label: 'Buổi tối (17:00 – 21:00)', icon: 'moon-outline' },
] as const;

/** Booking modal groups, in web order; empty periods are omitted. */
export function groupSlots(slots: readonly AvailabilitySlot[]) {
  return SLOT_PERIODS.map((period) => ({
    ...period,
    slots: slots.filter((slot) => slot.slotType === period.key),
  })).filter((period) => period.slots.length > 0);
}

/** Web renderSlotButton: caption, caption tone and whether the slot can be picked. */
export function getSlotView(slot: AvailabilitySlot): {
  label: string;
  tone: AppointmentTone;
  disabled: boolean;
} {
  if (slot.status === 'UNAVAILABLE')
    return { label: 'Không khả dụng', tone: 'neutral', disabled: true };
  if (slot.status === 'PENDING_YOU')
    return { label: 'Bạn đang chờ duyệt', tone: 'warning', disabled: true };
  if (slot.status === 'CONFIRMED_YOU')
    return { label: 'Lịch của bạn', tone: 'primary', disabled: true };
  const count = slot.bookingCount ?? 0;
  return count > 0
    ? { label: `${count} lượt đặt xem`, tone: 'primary', disabled: false }
    : { label: 'Còn trống', tone: 'success', disabled: false };
}

export function isSameSlot(
  a: Pick<AvailabilitySlot, 'startTime' | 'endTime'> | null,
  b: Pick<AvailabilitySlot, 'startTime' | 'endTime'>
) {
  return a?.startTime === b.startTime && a?.endTime === b.endTime;
}

// ---- Weekdays, dates, money ----

export const DAY_OF_WEEK_LABELS: Record<string, string> = {
  MONDAY: 'Thứ 2',
  TUESDAY: 'Thứ 3',
  WEDNESDAY: 'Thứ 4',
  THURSDAY: 'Thứ 5',
  FRIDAY: 'Thứ 6',
  SATURDAY: 'Thứ 7',
  SUNDAY: 'Chủ nhật',
};

/** Indexed by Date.getDay(). */
export const DAY_NUM_TO_ENUM = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export function formatAllowedDays(days: readonly string[] | null | undefined) {
  return days?.length
    ? days.map((day) => DAY_OF_WEEK_LABELS[day] || day).join(', ')
    : 'Tất cả các ngày';
}

const isAllowedWeekday = (date: Date, allowedDays: readonly string[]) =>
  allowedDays.includes(DAY_NUM_TO_ENUM[getDay(date)]!);

/** Web calendar `disabled`: past days, plus closed weekdays. No/empty list closes no weekday. */
export function isViewingDayDisabled(
  date: Date,
  allowedDays: readonly string[] | null | undefined,
  now = new Date()
) {
  if (isBefore(date, startOfDay(now))) return true;
  return Boolean(allowedDays?.length) && !isAllowedWeekday(date, allowedDays!);
}

/**
 * Web auto-jump after loading availability: null keeps the selected date, otherwise the first open
 * weekday within 14 days from today (today when none).
 */
export function nextAllowedViewingDate(
  selected: Date,
  allowedDays: readonly string[] | null | undefined,
  now = new Date()
): Date | null {
  if (!allowedDays?.length || isAllowedWeekday(selected, allowedDays)) return null;
  for (let i = 0; i < 14; i++) {
    const day = addDays(now, i);
    if (isAllowedWeekday(day, allowedDays)) return day;
  }
  return now;
}

export const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

/** "yyyy-MM-dd" as a local date (never UTC); undefined when malformed. */
export function parseDateKey(value: string | null | undefined): Date | undefined {
  const [y, m, d] = (value ?? '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

/** "Thứ Tư, 25/11/2026"; the raw text when it is not a date. */
export function formatDateLabel(value: string | null | undefined) {
  if (!value) return '';
  const date = parseDateKey(value);
  return date ? formatLongDate(date) : value;
}

export const formatLongDate = (date: Date) => format(date, 'EEEE, dd/MM/yyyy', { locale: vi });

export const formatTime = (time: string | null | undefined) => time?.slice(0, 5) ?? '';

export const formatTimeRange = (start: string | null | undefined, end: string | null | undefined) =>
  `${formatTime(start)} – ${formatTime(end)}`;

export const formatVND = (price: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(price);

/** Web AppointmentDateFilter: which chip is active and what the chips say. */
export function getDateFilterState(selectedDate: string | undefined, now = new Date()) {
  const todayKey = toDateKey(now);
  const tomorrowKey = toDateKey(addDays(now, 1));
  const date = parseDateKey(selectedDate);
  const label = date ? formatLongDate(date) : (selectedDate ?? '');
  const isToday = selectedDate === todayKey;
  const isTomorrow = selectedDate === tomorrowKey;
  const isCustom = Boolean(selectedDate) && !isToday && !isTomorrow;
  return {
    todayKey,
    tomorrowKey,
    date,
    isAll: !selectedDate,
    isToday,
    isTomorrow,
    isCustom,
    customButtonLabel: isCustom ? label : 'Chọn ngày khác',
    /** Empty when no date is filtered. */
    summary: isToday ? `Hôm nay (${label})` : isTomorrow ? `Ngày mai (${label})` : label,
  };
}

// ---- List tabs, paging, calendar ----

export const STATUS_TABS = [
  { label: 'Lịch xem', value: 'CALENDAR', icon: 'calendar-outline' },
  { label: 'Chờ xác nhận', value: 'PENDING', icon: 'time-outline' },
  { label: 'Đã hoàn thành', value: 'COMPLETED', icon: 'calendar-outline' },
  { label: 'Đã hủy', value: 'CANCELLED', icon: 'close-circle-outline' },
  { label: 'Đã từ chối', value: 'REJECTED', icon: 'close-circle-outline' },
] as const;
export type AppointmentTab = (typeof STATUS_TABS)[number]['value'];

export const LIST_PAGE_SIZE = 10;

/** Every CONFIRMED then every COMPLETED page (size 50), like the web calendar tab. */
export async function loadCalendarAppointments(
  list: (params: {
    status: string;
    page: number;
    size: number;
  }) => Promise<PageResponse<AppointmentResponse>>
) {
  const appointments: AppointmentResponse[] = [];
  for (const status of ['CONFIRMED', 'COMPLETED']) {
    let page = 1;
    let totalPages = 1;
    do {
      const response = await list({ status, page, size: 50 });
      appointments.push(...(response.result || []));
      if (page === 1) totalPages = response.totalPages;
      page++;
    } while (page <= totalPages);
  }
  return appointments;
}

export const CALENDAR_WEEKDAY_LABELS = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ nhật',
];

export const shiftCalendar = (anchor: Date, view: CalendarView, amount: number) =>
  view === 'month' ? addMonths(anchor, amount) : addWeeks(anchor, amount);

export function getCalendarTitle(anchor: Date, view: CalendarView) {
  if (view === 'month') return `Tháng ${format(anchor, 'MM/yyyy')}`;
  const days = getAppointmentCalendarDays(anchor, 'week');
  return `${format(days[0]!, 'dd/MM')} – ${format(days[6]!, 'dd/MM/yyyy')}`;
}

/** Keyed by appointmentDate, each day sorted by start time. */
export function groupAppointmentsByDate<
  T extends Pick<AppointmentResponse, 'appointmentDate' | 'startTime'>,
>(appointments: readonly T[]) {
  const grouped = new Map<string, T[]>();
  for (const appointment of appointments) {
    const items = grouped.get(appointment.appointmentDate) ?? [];
    items.push(appointment);
    grouped.set(appointment.appointmentDate, items);
  }
  grouped.forEach((items) => items.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  return grouped;
}

// ---- Actions ----

export type AppointmentAction =
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'complete'
  | 'approve-reschedule'
  | 'reject-reschedule'
  | 'request-reschedule';

export type AppointmentActionOption = {
  action: AppointmentAction;
  label: string;
  /** banner = inside the pending-reschedule box; footer = bottom bar of the detail modal. */
  placement: 'banner' | 'footer';
  /** Disable the button with useFeatureGate(permission); null = never gated. */
  permission: PermissionCode | null;
  danger: boolean;
};

const option = (
  action: AppointmentAction,
  label: string,
  permission: PermissionCode | null,
  danger = false,
  placement: AppointmentActionOption['placement'] = 'footer'
): AppointmentActionOption => ({ action, label, permission, danger, placement });

/** The buttons of the web detail modal, in render order. */
export function getAppointmentActions(
  appointment: Pick<AppointmentResponse, 'status' | 'rescheduleRequested'>,
  role: AppointmentViewRole
): AppointmentActionOption[] {
  const { status, rescheduleRequested } = appointment;
  const actions: AppointmentActionOption[] = [];
  if (role === 'OWNER') {
    const manage = PERMISSIONS.APPOINTMENT_MANAGE;
    if (rescheduleRequested)
      actions.push(
        option('approve-reschedule', 'Đồng ý đổi lịch', manage, false, 'banner'),
        option('reject-reschedule', 'Từ chối đổi', manage, true, 'banner')
      );
    if (status === 'PENDING')
      actions.push(
        option('reject', 'Từ chối lịch hẹn', manage, true),
        option('approve', 'Chấp nhận lịch hẹn', manage)
      );
    if (status === 'CONFIRMED')
      actions.push(
        option('cancel', 'Hủy lịch hẹn', manage, true),
        option('complete', 'Đã tiếp khách xong', manage)
      );
  } else if (isActiveBooking(appointment)) {
    actions.push(option('cancel', 'Hủy lịch hẹn', null, true));
    if (!rescheduleRequested)
      actions.push(option('request-reschedule', 'Yêu cầu đổi lịch', PERMISSIONS.APPOINTMENT_BOOK));
  }
  return actions;
}

/** The list card's only quick button ("Duyệt"). */
export const canQuickApprove = (
  appointment: Pick<AppointmentResponse, 'status'>,
  role: AppointmentViewRole
) => role === 'OWNER' && appointment.status === 'PENDING';

/** Owner dialogs. Other owner actions (complete, approve-reschedule) run with no dialog. */
export const OWNER_ACTION_DIALOGS = {
  approve: {
    title: 'Chấp nhận lịch hẹn xem nhà',
    message: 'Bạn có thể để lại lời dặn dò cho khách thuê nếu cần (chỗ để xe, người mở cửa...):',
    placeholder: 'Ví dụ: Đến nơi gọi tôi theo số này để mở cổng nhé...',
    requiredMessage: null,
  },
  reject: {
    title: 'Từ chối lịch hẹn',
    message: 'Vui lòng nhập lý do từ chối để khách thuê nắm được thông tin:',
    placeholder: 'Nhập lý do cụ thể...',
    requiredMessage: 'Vui lòng nhập lý do từ chối',
  },
  cancel: {
    title: 'Hủy lịch hẹn đã xác nhận',
    message: 'Vui lòng nhập lý do hủy lịch hẹn để thông báo đến khách thuê:',
    placeholder: 'Nhập lý do cụ thể...',
    requiredMessage: 'Vui lòng nhập lý do hủy lịch',
  },
  'reject-reschedule': {
    title: 'Từ chối yêu cầu đổi lịch',
    message: 'Vui lòng nhập lý do từ chối đổi thời gian mới:',
    placeholder: 'Nhập lý do cụ thể...',
    requiredMessage: 'Vui lòng nhập lý do từ chối yêu cầu đổi lịch',
  },
} as const;
export type OwnerDialogType = keyof typeof OWNER_ACTION_DIALOGS;

export function validateOwnerDialog(type: OwnerDialogType, input: string): string | null {
  return input.trim() ? null : OWNER_ACTION_DIALOGS[type].requiredMessage;
}

// ---- Deep link ----

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tab that shows a status. EXPIRED has no tab, so the detail opens without switching. */
export function tabForStatus(status: string): AppointmentTab | null {
  if (status === 'CONFIRMED') return 'CALENDAR';
  if (['PENDING', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(status))
    return status as AppointmentTab;
  return null;
}

/** `appointmentId` and `status` from a query string. Anything malformed is ignored. */
export function parseDeepLink(search: string): { id: string; hint: string | null } | null {
  const pairs = search.replace(/^\?/, '').split('&');
  const param = (name: string) => {
    const pair = pairs.find((part) => part.split('=')[0] === name);
    try {
      return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
    } catch {
      return null;
    }
  };
  const id = param('appointmentId');
  if (!id || !UUID.test(id)) return null;
  const status = param('status');
  return {
    id: id.toLowerCase(),
    hint: status && status in APPOINTMENT_STATUS_META ? status : null,
  };
}

// ---- Booking form ----

/** visitor and note limits are web UI rules; name, phone and reason limits come from the backend DTOs. */
export const BOOKING_LIMITS = {
  minVisitors: 1,
  maxVisitors: 10,
  noteLength: 500,
  nameLength: 100,
  phoneLength: 20,
  reasonLength: 500,
} as const;

export const clampVisitors = (count: number) =>
  Math.min(BOOKING_LIMITS.maxVisitors, Math.max(BOOKING_LIMITS.minVisitors, count));

/** First failing web check, or null. Web does not validate the phone format. */
export function validateBookingForm(form: {
  slot: AvailabilitySlot | null;
  renterName: string;
  renterPhone: string;
}): string | null {
  if (!form.slot) return 'Vui lòng chọn khung giờ xem nhà';
  if (!form.renterName.trim()) return 'Vui lòng nhập họ và tên của bạn';
  if (!form.renterPhone.trim()) return 'Vui lòng nhập số điện thoại liên hệ';
  return null;
}

export const validateRescheduleForm = (slot: AvailabilitySlot | null) =>
  slot ? null : 'Vui lòng chọn khung giờ mới bạn muốn đổi sang';

/** Web order is last name first. */
export function getRenterDefaultName(profile: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  return (
    [profile.lastName, profile.firstName].filter(Boolean).join(' ').trim() || profile.username || ''
  );
}

export function toCreateRequest(form: {
  listingId: string;
  date: Date;
  slot: AvailabilitySlot;
  renterName: string;
  renterPhone: string;
  visitorCount: number;
  renterNote: string;
}): CreateAppointmentRequest {
  return {
    listingId: form.listingId,
    appointmentDate: toDateKey(form.date),
    startTime: form.slot.startTime,
    endTime: form.slot.endTime,
    renterName: form.renterName.trim(),
    renterPhone: form.renterPhone.trim(),
    visitorCount: form.visitorCount,
    renterNote: form.renterNote.trim() || undefined,
  };
}

export function toRescheduleRequest(form: {
  date: Date;
  slot: AvailabilitySlot;
  reason: string;
}): RescheduleAppointmentRequest {
  return {
    proposedDate: toDateKey(form.date),
    proposedStartTime: form.slot.startTime,
    proposedEndTime: form.slot.endTime,
    rescheduleReason: form.reason.trim() || undefined,
  };
}
