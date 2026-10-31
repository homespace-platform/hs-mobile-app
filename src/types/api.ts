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

export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean | null;
  avatarUrl?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  role?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  kycVerified?: boolean | null;
  kycOptional?: boolean | null;
}
