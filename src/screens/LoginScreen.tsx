import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Sign-in entry. Credentials are only ever entered on the HomeSpace Keycloak page
 * (system auth browser + PKCE), which also provides Google login and password reset.
 */
export default function LoginScreen({ onRegister }: { onRegister: () => void }) {
  const { login, canLogin, error } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const disabled = !canLogin || opening;

  async function openLogin() {
    if (disabled) return;
    setOpening(true);
    setFormError(null);
    try {
      await login();
    } catch (loginError) {
      setFormError(
        loginError instanceof Error ? loginError.message : 'Không mở được trang đăng nhập'
      );
    } finally {
      setOpening(false);
    }
  }

  const message = formError ?? error;

  return (
    <AuthLayout title="Chào mừng trở lại" subtitle="Đăng nhập để tiếp tục tìm nơi ở phù hợp.">
      {message ? (
        <Text
          accessibilityRole="alert"
          className="mt-6 rounded-lg bg-danger-soft px-3 py-2 text-center text-xs text-danger">
          {message}
        </Text>
      ) : null}

      <Pressable
        disabled={disabled}
        onPress={openLogin}
        accessibilityRole="button"
        accessibilityLabel="Đăng nhập"
        accessibilityState={{ disabled, busy: opening }}
        className={`mt-7 min-h-12 flex-row items-center justify-center gap-2 rounded-xl py-3 ${disabled ? 'bg-disabled' : 'bg-brand'}`}>
        {opening ? <ActivityIndicator className="text-on-disabled" /> : null}
        <Text
          className={`text-center text-sm font-semibold ${disabled ? 'text-on-disabled' : 'text-on-brand'}`}>
          {opening ? 'Đang mở trang đăng nhập...' : canLogin ? 'Đăng nhập' : 'Đang chuẩn bị...'}
        </Text>
      </Pressable>

      <Text className="mt-3 text-center text-xs leading-5 text-muted-foreground">
        Đăng nhập bằng tài khoản HomeSpace hoặc Google. Bạn sẽ tự động quay lại ứng dụng sau khi xác
        thực.
      </Text>

      <Pressable
        onPress={onRegister}
        disabled={opening}
        accessibilityRole="button"
        className="mt-5 min-h-12 items-center justify-center rounded-xl border border-border-strong py-3">
        <Text className="text-center text-sm font-semibold text-secondary">Tạo tài khoản mới</Text>
      </Pressable>
    </AuthLayout>
  );
}
