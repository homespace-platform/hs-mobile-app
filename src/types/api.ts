export interface ApiResponse<T> {
  code: number;
  message?: string;
  result: T;
}

export interface PageResponse<T> extends Omit<ApiResponse<T[]>, 'result'> {
  result: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasMore: boolean;
}

export interface VietmapAddress {
  refId: string;
  display: string;
  name?: string | null;
  houseNumber?: string | null;
  street: string;
  address: string;
  cityId: string;
  city: string;
  districtId?: string | null;
  district?: string | null;
  wardId: string;
  ward: string;
  latitude: number;
  longitude: number;
  addressNote?: string | null;
}
export type UserAddress = VietmapAddress & { id?: string };

export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean | null;
  avatarUrl?: string | null;
  avatarStorageId?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  roleId?: string | null;
  role?: string | null;
  onBoarded?: boolean | null;
  active?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  kycVerified?: boolean | null;
  kycOptional?: boolean | null;
  address?: UserAddress | null;
}
