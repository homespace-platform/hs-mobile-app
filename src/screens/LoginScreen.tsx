import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/features/auth/AuthProvider';

export default function LoginScreen({ onRegister }: { onRegister: () => void }) {
  const { login, loginWithPassword, canLogin, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openingSso, setOpeningSso] = useState(false);
  const busy = submitting || openingSso;

  async function openSso() {
    if (busy) return;
    setOpeningSso(true);
    setFormError(null);
    try {
      await login();
    } catch (loginError) {
      setFormError(loginError instanceof Error ? loginError.message : 'Không mở được đăng nhập');
    } finally {
      setOpeningSso(false);
    }
  }

  const submit = async () => {
    if (busy) return;
    if (!username.trim() || !password) {
      setFormError('Vui lòng nhập tài khoản và mật khẩu');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await loginWithPassword(username.trim(), password);
    } catch (loginError: unknown) {
      setFormError(loginError instanceof Error ? loginError.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Chào mừng trở lại" subtitle="Đăng nhập để tiếp tục tìm nơi ở phù hợp.">
      <Text className="mt-7 text-sm font-medium text-secondary">Tài khoản hoặc email</Text>
      <TextInput
        autoCapitalize="none"
        accessibilityLabel="Tài khoản hoặc email"
        autoComplete="username"
        editable={!busy}
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setUsername}
        placeholder="Nhập tài khoản hoặc email"
        className="mt-2 rounded-xl border border-border px-4 py-3 text-foreground selection:text-primary placeholder:text-subtle"
        value={username}
      />

      <Text className="mt-4 text-sm font-medium text-secondary">Mật khẩu</Text>
      <TextInput
        autoCapitalize="none"
        accessibilityLabel="Mật khẩu"
        autoComplete="current-password"
        editable={!busy}
        autoCorrect={false}
        onChangeText={setPassword}
        placeholder="Nhập mật khẩu"
        secureTextEntry
        className="mt-2 rounded-xl border border-border px-4 py-3 text-foreground selection:text-primary placeholder:text-subtle"
        value={password}
      />

      {formError || error ? (
        <Text
          accessibilityRole="alert"
          className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-center text-xs text-danger">
          {formError ?? error}
        </Text>
      ) : null}

      <Pressable
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy: submitting }}
        onPress={submit}
        className={`mt-6 min-h-12 items-center justify-center rounded-xl py-3 ${busy ? 'bg-disabled' : 'bg-inverse'}`}>
        {submitting ? (
          <ActivityIndicator className="text-on-disabled" />
        ) : (
          <Text
            className={`text-center text-sm font-semibold ${busy ? 'text-on-disabled' : 'text-on-inverse'}`}>
            Đăng nhập
          </Text>
        )}
      </Pressable>

      <View className="my-5 flex-row items-center">
        <View className="h-px flex-1 bg-border" />
        <Text className="px-3 text-xs text-subtle">hoặc</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <Pressable
        disabled={!canLogin || busy}
        onPress={openSso}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canLogin || busy, busy: openingSso }}
        className={`min-h-12 items-center justify-center rounded-xl border py-3 ${canLogin && !busy ? 'border-border-strong' : 'border-border'}`}>
        <Text
          className={`text-center text-sm font-semibold ${canLogin && !busy ? 'text-secondary' : 'text-subtle'}`}>
          {openingSso ? 'Đang mở đăng nhập...' : 'Đăng nhập qua Keycloak SSO'}
        </Text>
      </Pressable>

      <Pressable
        onPress={onRegister}
        disabled={busy}
        accessibilityRole="button"
        className="mt-4 min-h-12 items-center justify-center px-2 py-3">
        <Text className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản? <Text className="font-semibold text-primary">Đăng ký ngay</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  );
}
