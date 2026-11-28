// Page-level rules of the web viewing-schedules pages (landlord and renter) and their hooks.
// No React Native imports: tests/appointment-manage.test.cjs loads this file in node.
import {
  LIST_PAGE_SIZE,
  loadCalendarAppointments,
  tabForStatus,
  type AppointmentAction,
  type AppointmentTab,
} from '@/lib/appointment';
import * as api from '@/services/appointmentApi';
import type { AppointmentResponse, AppointmentViewRole } from '@/types/appointment';

export const PAGE_COPY = {
  OWNER: {
    title: 'Lịch tiếp khách (Chủ nhà)',
    subtitle: 'Quản lý các yêu cầu đặt lịch xem nhà từ khách thuê gửi đến bài đăng của bạn.',
    loadError: 'Không thể tải danh sách lịch tiếp khách.',
    loadingCalendar: 'Đang tải calendar lịch tiếp khách...',
    loadingList: 'Đang tải danh sách lịch tiếp khách...',
    emptyTitle: 'Không có lịch hẹn nào',
    emptyFiltered:
      'Không tìm thấy lịch hẹn nào trong ngày đã chọn. Thử chọn ngày khác hoặc xem tất cả.',
    emptyAll: 'Hiện chưa có khách hàng nào đặt lịch xem nhà của bạn.',
  },
  RENTER: {
    title: 'Lịch tôi đi xem (Khách thuê)',
    subtitle: 'Theo dõi các lịch hẹn xem nhà bạn đã đăng ký trực tiếp với các chủ nhà.',
    loadError: 'Không thể tải danh sách lịch đi xem.',
    loadingCalendar: 'Đang tải calendar lịch đi xem của bạn...',
    loadingList: 'Đang tải danh sách lịch đi xem của bạn...',
    emptyTitle: 'Bạn chưa có lịch hẹn xem nhà nào',
    emptyFiltered: 'Không có lịch hẹn nào vào ngày đã chọn. Thử đổi ngày khác hoặc bấm xem tất cả.',
    emptyAll: 'Khám phá các căn hộ đang cho thuê trên HomeSpace và đặt lịch xem nhà ngay.',
  },
} as const;

export type AppointmentQuery = { tab: AppointmentTab; date?: string; page: number };

/** Identifies the rows on screen: the calendar tab ignores the date filter and paging. */
export const queryKey = ({ tab, date, page }: AppointmentQuery) =>
  tab === 'CALENDAR' ? tab : `${tab}|${date ?? ''}|${page}`;

export type AppointmentList = { rows: AppointmentResponse[]; total: number; totalPages: number };

export async function fetchAppointmentList(
  role: AppointmentViewRole,
  { tab, date, page }: AppointmentQuery
): Promise<AppointmentList> {
  const list = role === 'OWNER' ? api.getOwnerAppointments : api.getMyBookings;
  if (tab === 'CALENDAR') {
    const rows = await loadCalendarAppointments(list);
    return { rows, total: rows.length, totalPages: 1 };
  }
  const response = await list({ status: tab, date, page, size: LIST_PAGE_SIZE });
  return {
    rows: response.result || [],
    total: response.totalElements || 0,
    totalPages: response.totalPages || 1,
  };
}

/** Owner: every count from the server. Renter: only PENDING, reusing the list total on that tab. */
export async function fetchStatusCounts(
  role: AppointmentViewRole,
  tab: AppointmentTab,
  listTotal: number
): Promise<Record<string, number>> {
  if (role === 'OWNER') return api.getOwnerAppointmentCounts();
  if (tab === 'PENDING') return { PENDING: listTotal };
  const pending = await api.getMyBookings({ status: 'PENDING', page: 1, size: 1 });
  return { PENDING: pending.totalElements || 0 };
}

export type ServerAction = Exclude<AppointmentAction, 'request-reschedule'>;

export function runAppointmentAction(
  role: AppointmentViewRole,
  action: ServerAction,
  id: string,
  input = ''
) {
  const text = input.trim();
  switch (action) {
    case 'approve':
      return api.approveAppointment(id, text || undefined);
    case 'reject':
      return api.rejectAppointment(id, text);
    case 'cancel':
      return role === 'OWNER'
        ? api.cancelByOwner(id, text)
        : api.cancelByRenter(id, text || undefined);
    case 'complete':
      return api.completeAppointment(id);
    case 'approve-reschedule':
      return api.approveReschedule(id);
    case 'reject-reschedule':
      return api.rejectReschedule(id, text);
  }
}

const ACTION_MESSAGES: Record<ServerAction, { success: string; failure: string }> = {
  approve: { success: 'Đã chấp nhận lịch xem nhà!', failure: 'Không thể chấp nhận lịch hẹn.' },
  reject: { success: 'Đã từ chối lịch xem nhà.', failure: 'Không thể từ chối lịch hẹn.' },
  cancel: { success: 'Đã hủy lịch hẹn xem nhà.', failure: 'Không thể hủy lịch hẹn.' },
  complete: {
    success: 'Đã đánh dấu hoàn thành buổi xem nhà!',
    failure: 'Không thể đánh dấu hoàn thành.',
  },
  'approve-reschedule': {
    success: 'Đã chấp nhận thời gian hẹn mới của khách!',
    failure: 'Không thể chấp nhận đổi lịch.',
  },
  'reject-reschedule': {
    success: 'Đã từ chối yêu cầu đổi lịch của khách.',
    failure: 'Không thể từ chối đổi lịch.',
  },
};

export const getActionMessages = (role: AppointmentViewRole, action: ServerAction) =>
  role === 'RENTER' && action === 'cancel'
    ? { ...ACTION_MESSAGES.cancel, success: 'Đã hủy lịch xem nhà thành công.' }
    : ACTION_MESSAGES[action];

type HttpError = { response?: { status?: number; data?: { message?: string } } } | null | undefined;

/** Web `err.response?.data?.message || fallback`. */
export const serverMessage = (error: unknown, fallback: string) =>
  (error as HttpError)?.response?.data?.message || fallback;

export type DeepLinkResult =
  { appointment: AppointmentResponse; tab: AppointmentTab | null } | { message: string };

/** Web useAppointmentDeepLink: the latest authorized detail, only on the side that owns it. */
export async function resolveDeepLink(
  id: string,
  role: AppointmentViewRole,
  getUserId: () => Promise<string>
): Promise<DeepLinkResult> {
  try {
    const [appointment, userId] = await Promise.all([api.getAppointment(id), getUserId()]);
    if ((role === 'OWNER' ? appointment.ownerId : appointment.renterId) !== userId)
      return { message: 'Lịch hẹn không thuộc phía tài khoản bạn đang xem.' };
    return { appointment, tab: tabForStatus(appointment.status) };
  } catch (error) {
    const status = (error as HttpError)?.response?.status;
    return {
      message:
        status === 403 || status === 404
          ? 'Lịch hẹn không còn tồn tại hoặc bạn không có quyền xem.'
          : 'Không thể mở lịch hẹn lúc này. Vui lòng thử lại.',
    };
  }
}

/** Mobile realtime events that mean web's "appointment-changed" (new notification or recovery). */
export const isAppointmentChangeEvent = (event: string, payload?: unknown) =>
  event === 'connect' ||
  event === 'notifications:changed' ||
  (event === 'notification:new' &&
    (payload as { category?: unknown } | null | undefined)?.category === 'APPOINTMENT');

/** Web useAppointmentNotifications: debounce, one run at a time, at most one trailing run. */
export function createCoalescedRunner(
  run: (isDisposed: () => boolean) => Promise<void>,
  delay = 250
) {
  let disposed = false;
  let running = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const isDisposed = () => disposed;
  const execute = async () => {
    pending = false;
    running = true;
    try {
      await run(isDisposed);
    } finally {
      running = false;
      if (pending && !disposed) timer = setTimeout(() => void execute(), delay);
    }
  };
  return {
    schedule() {
      if (disposed) return;
      pending = true;
      if (!running) {
        clearTimeout(timer);
        timer = setTimeout(() => void execute(), delay);
      }
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
