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
// Same endpoint as web favoriteService.removeFavorite.
export async function removeFavorite(listingId: string) {
  await axiosClient.delete(`/api/v1/favorites/${encodeURIComponent(listingId)}`);
}
export async function getFavorites(page: number, size = 12) {
  return (
    await axiosClient.get<PageResponse<ListingSummary>>('/api/v1/favorites', {
      params: { page, size },
    })
  ).data;
}
export async function recordListingHistory(listingId: string) {
  await axiosClient.post(`/api/v1/history/${encodeURIComponent(listingId)}`);
}
export async function getHistory(page: number, size = 12) {
  return (
    await axiosClient.get<PageResponse<ListingSummary>>('/api/v1/history', {
      params: { page, size },
    })
  ).data;
}
// Same endpoint as web historyService.clearMyHistory.
export async function clearHistory() {
  await axiosClient.delete('/api/v1/history');
}
