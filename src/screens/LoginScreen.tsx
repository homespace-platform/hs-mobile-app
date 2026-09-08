import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

export default function LoginScreen() {
  const { login, loginWithPassword, canLogin, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-slate-50">
      <View className="flex-1 justify-center px-6">
        <View className="w-full max-w-sm self-center rounded-3xl border border-slate-200 bg-white p-7">
          <Text className="text-center text-3xl font-bold text-slate-900">HomeSpace</Text>
          <Text className="mt-2 text-center text-sm text-slate-500">
            Đăng nhập để tiếp tục tìm nơi ở phù hợp
          </Text>

          <Text className="mt-7 text-sm font-medium text-slate-700">Tài khoản hoặc email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setUsername}
            placeholder="Nhập tài khoản hoặc email"
            placeholderTextColor="#94a3b8"
            className="mt-2 rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
            value={username}
          />

          <Text className="mt-4 text-sm font-medium text-slate-700">Mật khẩu</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPassword}
            placeholder="Nhập mật khẩu"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            className="mt-2 rounded-xl border border-slate-200 px-4 py-3 text-slate-800"
            value={password}
          />

          {formError || error ? (
            <Text className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">
              {formError ?? error}
            </Text>
          ) : null}

          <Pressable
            disabled={submitting}
            onPress={submit}
            className={`mt-6 rounded-xl py-3 ${submitting ? 'bg-slate-300' : 'bg-slate-900'}`}>
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-center text-sm font-semibold text-white">Đăng nhập</Text>
            )}
          </Pressable>

          <View className="my-5 flex-row items-center">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="px-3 text-xs text-slate-400">hoặc</Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>

          <Pressable
            disabled={!canLogin}
            onPress={login}
            className={`rounded-xl border py-3 ${canLogin ? 'border-slate-300' : 'border-slate-200'}`}>
            <Text
              className={`text-center text-sm font-semibold ${canLogin ? 'text-slate-700' : 'text-slate-400'}`}>
              Đăng nhập qua Keycloak SSO
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
