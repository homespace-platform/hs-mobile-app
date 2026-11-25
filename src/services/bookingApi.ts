import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export async function getReservationPolicy() {
  return (
    await axiosClient.get<ApiResponse<{ version: string; text: string }>>(
      '/api/v1/rental-requests/reservation-policy'
    )
  ).data.result;
}
