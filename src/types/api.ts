export interface ApiResponse<T> {
  code: number;
  message?: string;
  result: T;
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
}
