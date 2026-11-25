import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';
import type { ListingAvailabilityResponse } from '@/types/appointment';

// Appointment calls live in appointmentApi; these names remain for the older booking screens.
export {
  createAppointment,
  getAvailability,
  getMyBookingByListing,
  requestReschedule as rescheduleAppointment,
} from '@/services/appointmentApi';
export type Availability = ListingAvailabilityResponse;

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

export type ActiveRentalRequest = { id: string; status: 'PENDING' | 'ACCEPTED' };

export async function getMyRentalRequestByListing(listingId: string) {
  return (
    await axiosClient.get<ApiResponse<ActiveRentalRequest | null>>(
      `/api/v1/rental-requests/by-listing/${encodeURIComponent(listingId)}`
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
  return (
    await axiosClient.post<ApiResponse<ActiveRentalRequest>>('/api/v1/rental-requests', payload)
  ).data.result;
}
