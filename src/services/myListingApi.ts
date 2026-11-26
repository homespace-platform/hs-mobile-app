// The signed-in owner's listings (web services/listing.service.ts).
import axiosClient from '@/lib/axios-client';
import type { ApiResponse, PageResponse } from '@/types/api';

export type MyListingSummary = {
  id: string;
  title: string;
  category: string;
  status: string;
  branchName?: string | null;
  availableFrom?: string | null;
  areaM2: number;
  priceAmount: number;
  priceUnit?: string;
  coverImageUrl?: string | null;
  mediaCount?: number;
  fullAddress?: string | null;
  statusReason?: string | null;
  submittedAt?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
};

export async function getMyListings({
  page,
  status,
  keyword,
}: {
  page: number;
  status?: string;
  keyword?: string;
}) {
  const response = await axiosClient.get<PageResponse<MyListingSummary>>('/api/v1/listings/me', {
    params: {
      page,
      ...(status ? { status } : {}),
      ...(keyword?.trim() ? { keyword: keyword.trim() } : {}),
    },
  });
  return response.data;
}

export async function getMyListingCounts() {
  const response = await axiosClient.get<ApiResponse<Record<string, number>>>(
    '/api/v1/listings/me/counts'
  );
  return response.data.result;
}

export async function changeListingStatus(id: string, status: string, reason?: string) {
  await axiosClient.patch(`/api/v1/listings/${encodeURIComponent(id)}/status`, {
    status,
    reason: reason?.trim() || undefined,
  });
}
