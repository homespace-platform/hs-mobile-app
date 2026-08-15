import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

export default function LoginScreen() {
  const { login, canLogin, error } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6">
      <View className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8">
        <Text className="text-center text-xl font-bold text-slate-800">HomeSpace</Text>
        <Text className="mt-1 text-center text-sm text-slate-500">
          Đăng nhập qua Keycloak SSO
        </Text>

        {error ? (
          <Text className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {error}
          </Text>
        ) : null}

        <Pressable
          disabled={!canLogin}
          onPress={login}
          className={`mt-6 rounded-xl py-3 ${canLogin ? 'bg-slate-900' : 'bg-slate-300'}`}>
          <Text className="text-center text-sm font-semibold text-white">Đăng nhập</Text>
        </Pressable>
      </View>
    </View>
  );
}
