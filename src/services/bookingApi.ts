import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export type Availability = {
  isDayAvailable: boolean;
  hasExistingActiveBooking: boolean;
  allowedViewingDays?: string[];
  slots: { startTime: string; endTime: string; status: string; slotType?: string }[];
};
export async function getAvailability(listingId: string, date: string, signal?: AbortSignal) {
  return (
    await axiosClient.get<ApiResponse<Availability>>(
      `/api/v1/appointments/availability/${encodeURIComponent(listingId)}`,
      { params: { date }, signal }
    )
  ).data.result;
}
export async function createAppointment(payload: {
  listingId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  renterName: string;
  renterPhone: string;
  visitorCount: number;
  renterNote: string;
}) {
  await axiosClient.post('/api/v1/appointments', payload);
}
export async function rescheduleAppointment(
  id: string,
  payload: {
    proposedDate: string;
    proposedStartTime: string;
    proposedEndTime: string;
    rescheduleReason: string;
  }
) {
  await axiosClient.put(`/api/v1/appointments/${encodeURIComponent(id)}/reschedule`, payload);
}
export type RentalEstimateInput = {
  listingId: string;
  moveInDate: string;
  leaseMonths: number;
  occupantCount: number;
  motorbikeCount: number;
  carCount: number;
};
export type RentalEstimate = {
  effectiveMonthlyRent: number;
  estimatedMonthlyTotal: number;
  depositAmount: number;
  estimatedInitialTotal: number;
  estimatedLeaseTotal: number;
  disclaimer: string;
  motorbike: { allowed: boolean; note: string };
  car: { allowed: boolean; note: string };
  paymentPlan?: { amountAfterApproval: number } | null;
};
export async function estimateRental(payload: RentalEstimateInput) {
  return (
    await axiosClient.post<ApiResponse<RentalEstimate>>('/api/v1/rental-requests/estimate', payload)
  ).data.result;
}
export async function getReservationPolicy() {
  return (
    await axiosClient.get<ApiResponse<{ version: string; text: string }>>(
      '/api/v1/rental-requests/reservation-policy'
    )
  ).data.result;
}
export async function createRentalRequest(
  payload: RentalEstimateInput & {
    renterName: string;
    renterPhone: string;
    renterEmail: string;
    renterNote: string;
    reservationPolicyAccepted: boolean;
    reservationPolicyVersion: string;
  }
) {
  await axiosClient.post('/api/v1/rental-requests', payload);
}
