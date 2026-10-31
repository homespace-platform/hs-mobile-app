import axiosClient from '@/lib/axios-client';
import type { ListingSummary } from '@/services/listingApi';
import type { ApiResponse, PageResponse } from '@/types/api';

export async function getFavoriteIds() {
  return (await axiosClient.get<ApiResponse<string[]>>('/api/v1/favorites/ids')).data.result;
}
export async function toggleFavorite(listingId: string) {
  return (
    await axiosClient.post<ApiResponse<{ isFavorite: boolean }>>(
      `/api/v1/favorites/${encodeURIComponent(listingId)}/toggle`
    )
  ).data.result.isFavorite;
}
export async function getFavorites(page: number) {
  return (
    await axiosClient.get<PageResponse<ListingSummary>>('/api/v1/favorites', {
      params: { page, size: 12 },
    })
  ).data;
}
export async function recordListingHistory(listingId: string) {
  await axiosClient.post(`/api/v1/history/${encodeURIComponent(listingId)}`);
}
