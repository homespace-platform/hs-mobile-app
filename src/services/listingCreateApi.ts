import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';
import type { PropertyCategoryKey } from '@/lib/listing-form';

export type ListingPolicyDefinition = {
  code: string;
  label: string;
  valueType: 'PERMISSION' | 'INTEGER' | 'TEXT';
  helpText?: string;
  unitLabel?: string;
  required: boolean;
  minimumValue?: number | null;
  maximumValue?: number | null;
  sortOrder?: number;
  choices?: { value: string; label: string }[];
};
export type ListingCatalog = {
  category: string;
  amenities: { code: string; name: string }[];
  furnishings: { code: string; name: string }[];
  policies: ListingPolicyDefinition[];
};
export type ListingSubmissionAction = 'SAVE_DRAFT' | 'SUBMIT_FOR_REVIEW';

export async function getListingCatalog(category: PropertyCategoryKey) {
  const response = await axiosClient.get<ApiResponse<ListingCatalog>>(
    '/api/v1/public/listing-catalog',
    { params: { category: category.toUpperCase() } }
  );
  return response.data.result;
}
export async function upsertListing(payload: Record<string, unknown>) {
  const response = await axiosClient.post<
    ApiResponse<{ id: string; status: string; pendingEditId?: string | null }>
  >('/api/v1/listings/upsert', payload);
  return response.data.result;
}
