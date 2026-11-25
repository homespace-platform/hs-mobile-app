import axiosClient from '@/lib/axios-client';
import {
  NEARBY_PAGE_SIZE,
  NEARBY_RADIUS_METERS,
  type NearbyGroup,
  type NearbyPage,
} from '@/lib/nearby';
import type { ApiResponse } from '@/types/api';

// Same endpoint and params as web services/nearby.service.ts.
export async function getNearbyPlaces(
  listingId: string,
  group: NearbyGroup | '',
  page: number,
  signal?: AbortSignal
) {
  const response = await axiosClient.get<ApiResponse<NearbyPage>>(
    `/api/v1/public/listings/${encodeURIComponent(listingId)}/nearby-places`,
    {
      params: {
        radiusMeters: NEARBY_RADIUS_METERS,
        ...(group ? { groups: group } : {}),
        page,
        size: NEARBY_PAGE_SIZE,
      },
      signal,
    }
  );
  return response.data.result;
}
