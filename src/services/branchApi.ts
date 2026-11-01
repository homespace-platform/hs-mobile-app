import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export type BranchCategory = 'APARTMENT' | 'HOUSE' | 'ROOM';
export type BranchCharge = {
  chargeType: string;
  billingMethod: string;
  amount?: number;
  currency?: string;
  unit?: string;
  includedInRent?: boolean;
  customName?: string;
  sortOrder?: number;
};
export type Branch = {
  id: string;
  name: string;
  code?: string;
  category: BranchCategory;
  refId: string;
  display: string;
  addressNote?: string;
  description?: string;
  buildingRules?: string;
  coverImageId?: string | null;
  coverImageUrl?: string | null;
  motorbikeParkingCapacity?: number;
  carParkingCapacity?: number;
  defaultCharges?: BranchCharge[];
  buildingAmenityCodes?: string[];
  totalUnits?: number;
  activeListingsCount?: number;
  isComplete?: boolean;
  missingCharges?: string[];
};
export type BranchInput = Pick<Branch, 'name' | 'category' | 'refId'> & {
  code?: string;
  addressNote?: string;
  description?: string;
  buildingRules?: string;
  coverImageId?: string | null;
  motorbikeParkingCapacity: number;
  carParkingCapacity: number;
  defaultCharges: BranchCharge[];
  buildingAmenityCodes?: string[];
};
export type AddressSuggestion = { refId: string; display: string; name: string; address: string };

export async function getBranches() {
  const response = await axiosClient.get<ApiResponse<Branch[]>>('/api/v1/branches');
  return response.data.result ?? [];
}
export async function getBranch(id: string) {
  const response = await axiosClient.get<ApiResponse<Branch>>(
    `/api/v1/branches/${encodeURIComponent(id)}`
  );
  return response.data.result;
}
export async function saveBranch(input: BranchInput, id?: string) {
  const path = id ? `/api/v1/branches/${encodeURIComponent(id)}` : '/api/v1/branches';
  const response = id
    ? await axiosClient.put<ApiResponse<Branch>>(path, input)
    : await axiosClient.post<ApiResponse<Branch>>(path, input);
  return response.data.result;
}
export async function deleteBranch(id: string) {
  await axiosClient.delete(`/api/v1/branches/${encodeURIComponent(id)}`);
}
export async function searchBranchAddress(text: string, signal?: AbortSignal) {
  const response = await axiosClient.get<ApiResponse<AddressSuggestion[]>>(
    '/api/v1/locations/autocomplete',
    { params: { text }, signal, timeout: 12000 }
  );
  return response.data.result ?? [];
}
