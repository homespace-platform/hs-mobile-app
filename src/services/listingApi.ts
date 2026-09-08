import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export const MOCK_LISTING_IMAGE =
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267d?auto=format&fit=crop&w=1200&q=80';

export function listingImage(url?: string | null) {
  return !url || url.includes('homespace-dev-files') ? MOCK_LISTING_IMAGE : url;
}

export type ListingSummary = {
  id: string;
  title: string;
  category: string;
  subtype: string;
  areaM2: number;
  priceAmount: number;
  priceUnit?: string;
  negotiable?: boolean;
  coverImageUrl?: string | null;
  imageUrls?: string[];
  fullAddress?: string | null;
  provinceName?: string | null;
  bedroomCount?: number | null;
  bathroomCount?: number | null;
  furnishingStatus?: string | null;
  ownerName?: string | null;
  publishedAt?: string | null;
  availableFrom?: string | null;
  viewCount?: number;
};

type DetailValues = Record<string, string | number | boolean | null | undefined>;

export type ListingDetail = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  subtype: string;
  rentalMode: string;
  status: string;
  availableFrom: string;
  areaM2: number;
  pricing: {
    amount: number;
    currency: string;
    unit: string;
    negotiable: boolean;
    depositType: string;
    depositAmount?: number | null;
    depositMonths?: number | null;
    paymentCycle: string;
    minimumLeaseMonths: number;
    managementFeeIncluded: boolean;
    vatIncluded?: boolean | null;
  };
  apartmentDetail?: DetailValues | null;
  houseDetail?: DetailValues | null;
  officeDetail?: DetailValues | null;
  commercialDetail?: DetailValues | null;
  roomDetail?: DetailValues | null;
  amenities: { code: string; name: string }[];
  customAmenities: string[];
  charges: {
    chargeType: string;
    billingMethod: string;
    amount?: number | null;
    unit?: string | null;
    includedInRent: boolean;
    customName?: string | null;
  }[];
  address?: {
    fullAddress?: string;
    provinceName: string;
    wardName: string;
    streetLine: string;
  } | null;
  owner?: {
    id: string;
    displayName: string;
    phone?: string | null;
    avatarUrl?: string | null;
  } | null;
  media: {
    id: string;
    mediaType: string;
    sortOrder: number;
    cover: boolean;
    url?: string | null;
  }[];
  viewingDays?: string[];
  viewingSlots?: string[];
  publishedAt?: string | null;
  viewCount?: number;
};

type PageResponse = { result?: ListingSummary[] };

export async function getPublicListings(params: Record<string, string | number>) {
  const response = await axiosClient.get<PageResponse>('/api/v1/public/listings', { params });
  return response.data.result ?? [];
}

export async function getPublicListing(id: string) {
  const response = await axiosClient.get<ApiResponse<ListingDetail>>(
    `/api/v1/public/listings/${id}`
  );
  return response.data.result;
}
