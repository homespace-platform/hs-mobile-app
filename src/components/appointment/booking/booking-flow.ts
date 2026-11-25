// State and API logic of hs-web-app BookingAppointmentModal, kept free of React so node tests can
// drive it. Dialogs and navigation stay in the components.
import { isBefore, startOfDay } from 'date-fns';

import { apiError } from '@/lib/api-error';
import {
  clampVisitors,
  getRenterDefaultName,
  getSlotView,
  nextAllowedViewingDate,
  toCreateRequest,
  toDateKey,
  toRescheduleRequest,
  validateBookingForm,
  validateRescheduleForm,
} from '@/lib/appointment';
import type * as appointmentApi from '@/services/appointmentApi';
import type {
  AppointmentResponse,
  AvailabilitySlot,
  ListingAvailabilityResponse,
} from '@/types/appointment';
import type { UserProfileResponse } from '@/types/api';

export type BookingFlowDeps = {
  api: Pick<
    typeof appointmentApi,
    | 'getMyBookingByListing'
    | 'getAvailability'
    | 'createAppointment'
    | 'requestReschedule'
    | 'cancelByRenter'
  >;
  getProfile: () => Promise<
    Pick<UserProfileResponse, 'firstName' | 'lastName' | 'username' | 'phone'>
  >;
  now?: () => Date;
};

export type BookingState = {
  loading: boolean;
  /** Set when availability could not be loaded (web only logs it). */
  loadError: string | null;
  /** One flag for submit and cancel, like web `submitting`. */
  submitting: boolean;
  existing: AppointmentResponse | null;
  availability: ListingAvailabilityResponse | null;
  date: Date;
  slot: AvailabilitySlot | null;
  renterName: string;
  renterPhone: string;
  visitorCount: number;
  renterNote: string;
  rescheduling: boolean;
  rescheduleReason: string;
  confirmingCancel: boolean;
  cancelReason: string;
};

export type BookingResult = { ok: boolean; message: string };

type TextField = 'renterName' | 'renterPhone' | 'renterNote' | 'rescheduleReason' | 'cancelReason';

const serverMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } } | undefined)?.response?.data?.message ||
  fallback;

export function createBookingFlow(
  listingId: string,
  { api, getProfile, now = () => new Date() }: BookingFlowDeps
) {
  let state: BookingState = {
    loading: true,
    loadError: null,
    submitting: false,
    existing: null,
    availability: null,
    date: now(),
    slot: null,
    renterName: '',
    renterPhone: '',
    visitorCount: 1,
    renterNote: '',
    rescheduling: false,
    rescheduleReason: '',
    confirmingCancel: false,
    cancelReason: '',
  };
  let opened = false;
  // Only the newest load may write; older replies are dropped.
  let latest = 0;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();

  function set(patch: Partial<BookingState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  function abort() {
    latest++;
    controller?.abort();
  }

  async function load(withBooking = true): Promise<void> {
    if (!opened) return;
    abort();
    const request = latest;
    controller = new AbortController();
    const { signal } = controller;
    const { date } = state;
    set({ loading: true, loadError: null });
    try {
      if (withBooking) {
        const booking = await api.getMyBookingByListing(listingId);
        if (request !== latest) return;
        // The lookup answers null on any failure; that must not strand a reschedule in progress.
        set({ existing: booking ?? (state.rescheduling ? state.existing : null) });
      }
      const availability = await api.getAvailability(listingId, toDateKey(date), signal);
      if (request !== latest) return;
      const next = nextAllowedViewingDate(date, availability?.allowedViewingDays, now());
      if (next && toDateKey(next) !== toDateKey(date)) {
        set({ availability, date: next, slot: null });
        return load(withBooking);
      }
      set({ availability, loading: false });
    } catch (error) {
      if (request === latest) set({ loading: false, loadError: apiError(error) });
    }
  }

  /** Never overwrites what the user already typed. */
  async function prefill() {
    try {
      const profile = await getProfile();
      set({
        renterName: state.renterName || getRenterDefaultName(profile),
        renterPhone: state.renterPhone || profile.phone || '',
      });
    } catch {
      // The fields stay editable.
    }
  }

  async function run(
    action: () => Promise<unknown>,
    success: string,
    fallback: string
  ): Promise<BookingResult> {
    set({ submitting: true });
    try {
      await action();
      return { ok: true, message: success };
    } catch (error) {
      return { ok: false, message: serverMessage(error, fallback) };
    } finally {
      set({ submitting: false });
    }
  }

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    open() {
      opened = true;
      if (isBefore(state.date, startOfDay(now()))) set({ date: now() });
      void load();
      void prefill();
    },
    /** Drops mode, slot and cancel confirmation; contact fields, notes and date survive. */
    close() {
      opened = false;
      abort();
      set({
        loading: true,
        loadError: null,
        slot: null,
        rescheduling: false,
        confirmingCancel: false,
        cancelReason: '',
      });
    },
    retry: () => void load(),
    selectDate(date: Date) {
      if (toDateKey(date) === toDateKey(state.date)) return;
      set({ date, slot: null });
      void load();
    },
    selectSlot(slot: AvailabilitySlot) {
      if (!getSlotView(slot).disabled) set({ slot });
    },
    setText: (field: TextField, value: string) => set({ [field]: value }),
    stepVisitors: (delta: number) =>
      set({ visitorCount: clampVisitors(state.visitorCount + delta) }),
    setRescheduling: (rescheduling: boolean) =>
      set({ rescheduling, slot: null, confirmingCancel: false }),
    setConfirmingCancel: (confirmingCancel: boolean) => set({ confirmingCancel }),

    /** Create or reschedule. null = ignored (already sending, or nothing to reschedule). */
    async submit(): Promise<BookingResult | null> {
      const { submitting, rescheduling, existing, slot, date } = state;
      if (submitting || (rescheduling && !existing)) return null;
      const invalid = rescheduling ? validateRescheduleForm(slot) : validateBookingForm(state);
      if (invalid) return { ok: false, message: invalid };
      return rescheduling
        ? run(
            () =>
              api.requestReschedule(
                existing!.id,
                toRescheduleRequest({ date, slot: slot!, reason: state.rescheduleReason })
              ),
            'Đã gửi yêu cầu đổi lịch đến chủ nhà!',
            'Không thể đổi lịch. Vui lòng thử lại.'
          )
        : run(
            () => api.createAppointment(toCreateRequest({ ...state, listingId, slot: slot! })),
            'Gửi yêu cầu đặt lịch thành công! Vui lòng chờ chủ nhà xác nhận.',
            'Không thể đặt lịch. Vui lòng thử lại.'
          );
    },

    async cancel(): Promise<BookingResult | null> {
      const { submitting, existing, cancelReason } = state;
      if (submitting || !existing) return null;
      return run(
        async () => {
          await api.cancelByRenter(existing.id, cancelReason);
          set({ existing: null, confirmingCancel: false, rescheduling: false, cancelReason: '' });
          void load(false);
        },
        'Đã hủy lịch xem nhà thành công',
        'Không thể hủy lịch. Vui lòng thử lại.'
      );
    },
  };
}

export type BookingFlow = ReturnType<typeof createBookingFlow>;

/** Web requireKyc; a cached "unverified" is re-read once before it blocks. */
export async function checkKyc(
  getProfile: (forceRefresh?: boolean) => Promise<Pick<UserProfileResponse, 'kycVerified'>>
): Promise<'verified' | 'unverified' | 'unavailable'> {
  try {
    let profile = await getProfile();
    if (profile?.kycVerified !== true) profile = await getProfile(true);
    if (!profile) return 'unavailable';
    return profile.kycVerified === true ? 'verified' : 'unverified';
  } catch {
    return 'unavailable';
  }
}
