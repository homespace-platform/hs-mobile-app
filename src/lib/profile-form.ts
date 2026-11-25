import type { ProfileUpdate } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';

// Mirrors hs-web-app validation/user.schema.ts (userProfileSchema).
export const VIETNAMESE_PHONE_REGEX = /^0(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_SOURCE_IMAGE_SIZE = 20 * 1024 * 1024;

export type ProfileErrors = Partial<Record<keyof ProfileUpdate, string>>;

export function profileToForm(profile: UserProfileResponse): ProfileUpdate {
  return {
    username: profile.username ?? '',
    email: profile.email ?? '',
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    phone: profile.phone ?? null,
  };
}

export function normalizeProfileForm(form: ProfileUpdate): ProfileUpdate {
  return {
    ...form,
    username: form.username.trim(),
    email: form.email.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone?.trim() || null,
  };
}

export function validateProfileForm(form: ProfileUpdate): ProfileErrors {
  const value = normalizeProfileForm(form);
  const errors: ProfileErrors = {};
  if (value.username.length < 3) errors.username = 'Tên đăng nhập phải có ít nhất 3 ký tự';
  else if (value.username.length > 50) errors.username = 'Tên đăng nhập không được quá 50 ký tự';
  else if (!/^[a-zA-Z0-9._-]+$/.test(value.username))
    errors.username = 'Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch ngang';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email.length > 100)
    errors.email = 'Email không đúng định dạng';
  if (value.firstName.length < 2) errors.firstName = 'Tên phải có ít nhất 2 ký tự';
  else if (value.firstName.length > 50) errors.firstName = 'Tên không được quá 50 ký tự';
  if (value.lastName.length < 2) errors.lastName = 'Họ phải có ít nhất 2 ký tự';
  else if (value.lastName.length > 50) errors.lastName = 'Họ không được quá 50 ký tự';
  if (value.phone && !VIETNAMESE_PHONE_REGEX.test(value.phone))
    errors.phone = 'Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0353999798)';
  return errors;
}

export function isProfileDirty(form: ProfileUpdate, baseline: ProfileUpdate) {
  return (
    JSON.stringify(normalizeProfileForm(form)) !== JSON.stringify(normalizeProfileForm(baseline))
  );
}

export function profileFullName(form: {
  firstName?: string;
  lastName?: string;
  username?: string;
}) {
  const name = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
  return name || form.username || 'Người dùng';
}

export function avatarMimeType(mime?: string | null, fileName?: string | null) {
  const reported = mime?.trim().toLowerCase();
  if (reported && reported !== 'application/octet-stream') return reported;
  const ext = fileName?.split('?')[0].split('.').pop()?.toLowerCase();
  return ext === 'png'
    ? 'image/png'
    : ext === 'webp'
      ? 'image/webp'
      : ext === 'jpg' || ext === 'jpeg' || !ext
        ? 'image/jpeg'
        : 'application/octet-stream';
}

export function avatarFileError(contentType: string, sizeBytes: number) {
  if (!AVATAR_TYPES.includes(contentType)) return 'Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.';
  if (sizeBytes > MAX_SOURCE_IMAGE_SIZE) return 'Ảnh gốc không được vượt quá 20 MB.';
  return null;
}

export function formatInstant(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

export function formatRole(role?: string | null) {
  if (role === 'USER') return 'Người dùng';
  if (role === 'ADMIN') return 'Quản trị viên';
  return role || 'Chưa được gán';
}

export function mapUrl(latitude?: number | null, longitude?: number | null) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;
}
