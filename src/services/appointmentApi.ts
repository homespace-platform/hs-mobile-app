// Port of hs-web-app services/appointment.service.ts: same endpoints, params, bodies and defaults.
// Errors propagate (read them with apiError); only getMyBookingByListing swallows them, like web.
import axiosClient from '@/lib/axios-client';
import type { ApiResponse, PageResponse } from '@/types/api';
import type {
  AppointmentResponse,
  CreateAppointmentRequest,
  ListingAvailabilityResponse,
  RescheduleAppointmentRequest,
} from '@/types/appointment';

const BASE = '/api/v1/appointments';
const path = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export type AppointmentListParams = {
  status?: string;
  date?: string;
  page?: number;
  size?: number;
};
export type OwnerAppointmentListParams = AppointmentListParams & { listingId?: string };

const listParams = (params?: AppointmentListParams) => ({
  status: params?.status && params.status !== 'ALL' ? params.status : undefined,
  date: params?.date || undefined,
  page: params?.page ?? 1,
  size: params?.size ?? 12,
});

async function put(url: string, body?: object) {
  return (await axiosClient.put<ApiResponse<AppointmentResponse>>(url, body)).data.result;
}

export async function getAppointment(id: string) {
  return (await axiosClient.get<ApiResponse<AppointmentResponse>>(path(id))).data.result;
}

export async function getAvailability(listingId: string, date?: string, signal?: AbortSignal) {
  return (
    await axiosClient.get<ApiResponse<ListingAvailabilityResponse>>(
      `${BASE}/availability/${encodeURIComponent(listingId)}`,
      { params: date ? { date } : undefined, signal }
    )
  ).data.result;
}

export async function createAppointment(req: CreateAppointmentRequest) {
  return (await axiosClient.post<ApiResponse<AppointmentResponse>>(BASE, req)).data.result;
}

export async function getMyBookings(params?: AppointmentListParams) {
  return (
    await axiosClient.get<PageResponse<AppointmentResponse>>(`${BASE}/my-bookings`, {
      params: listParams(params),
    })
  ).data;
}

/** The renter's PENDING/CONFIRMED booking of a listing; null when there is none or the lookup fails. */
export async function getMyBookingByListing(listingId: string) {
  try {
    return (
      (
        await axiosClient.get<ApiResponse<AppointmentResponse | null>>(
          `${BASE}/my-bookings/by-listing/${encodeURIComponent(listingId)}`
        )
      ).data.result ?? null
    );
  } catch {
    return null;
  }
}

export function requestReschedule(id: string, req: RescheduleAppointmentRequest) {
  return put(`${path(id)}/reschedule`, req);
}

export function cancelByRenter(id: string, cancelReason?: string) {
  return put(`${path(id)}/cancel`, {
    cancelReason: cancelReason || 'Khách hàng tự hủy lịch hẹn',
  });
}

export async function getOwnerAppointments(params?: OwnerAppointmentListParams) {
  return (
    await axiosClient.get<PageResponse<AppointmentResponse>>(`${BASE}/owner`, {
      params: { listingId: params?.listingId || undefined, ...listParams(params) },
    })
  ).data;
}

export async function getOwnerAppointmentCounts(): Promise<Record<string, number>> {
  return (
    (await axiosClient.get<ApiResponse<Record<string, number>>>(`${BASE}/owner/counts`)).data
      .result ?? {}
  );
}

export function approveAppointment(id: string, ownerNote?: string) {
  return put(`${path(id)}/approve`, { ownerNote });
}

export function rejectAppointment(id: string, rejectReason: string) {
  return put(`${path(id)}/reject`, { rejectReason });
}

export function approveReschedule(id: string) {
  return put(`${path(id)}/reschedule/approve`);
}

export function rejectReschedule(id: string, rejectReason: string) {
  return put(`${path(id)}/reschedule/reject`, { rejectReason });
}

export function cancelByOwner(id: string, cancelReason: string) {
  return put(`${path(id)}/owner-cancel`, { cancelReason });
}

export function completeAppointment(id: string) {
  return put(`${path(id)}/complete`);
}
