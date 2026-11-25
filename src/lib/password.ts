// Mirrors hs-web-app validation/password.schema.ts (same messages and order).
export function validatePasswordChange(
  oldPassword: string,
  newPassword: string,
  confirmPassword: string,
  requireOld = true
): string | null {
  if (requireOld && !oldPassword) return 'Vui lòng nhập mật khẩu hiện tại';
  if (newPassword.length < 8) return 'Mật khẩu mới phải có ít nhất 8 ký tự';
  if (!/[A-Z]/.test(newPassword)) return 'Mật khẩu mới phải có ít nhất một chữ hoa';
  if (!/[0-9]/.test(newPassword)) return 'Mật khẩu mới phải có ít nhất một chữ số';
  if (!/[@#$%^&+=!]/.test(newPassword))
    return 'Mật khẩu mới phải có ít nhất một ký tự đặc biệt (@#$%^&+=!)';
  if (!confirmPassword) return 'Vui lòng xác nhận mật khẩu mới';
  if (newPassword !== confirmPassword) return 'Mật khẩu xác nhận không trùng khớp';
  return null;
}
