import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';

import AuthLayout from '@/components/AuthLayout';
import Icon from '@/components/Icon';
import { useAuth } from '@/features/auth/AuthProvider';

export default function RegisterScreen({ onBack }: { onBack: () => void }) {
  const { register } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!submitting) onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack, submitting]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await register();
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : 'Không mở được trang đăng ký'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Tạo tài khoản" subtitle="Bắt đầu tìm nơi ở phù hợp cùng HomeSpace.">
      <View className="mt-6 rounded-2xl bg-primary-soft p-4">
        <Icon name="person-add-outline" size={28} className="self-center text-primary" />
        <Text className="mt-3 text-center text-sm font-semibold text-foreground">
          Một tài khoản cho web và ứng dụng
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-secondary">
          Tiếp tục tới trang đăng ký HomeSpace để điền tên, email và mật khẩu. Sau khi hoàn tất các
          bước xác thực, bạn sẽ được đưa về ứng dụng.
        </Text>
      </View>

      {error ? (
        <Text
          accessibilityRole="alert"
          className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting, busy: submitting }}
        className={`mt-6 min-h-12 flex-row items-center justify-center rounded-xl px-4 py-3 ${submitting ? 'bg-disabled' : 'bg-brand'}`}>
        {submitting ? (
          <ActivityIndicator className="mr-2 text-on-disabled" />
        ) : (
          <Icon name="person-add-outline" size={20} className="mr-2 text-on-brand" />
        )}
        <Text
          className={`text-sm font-semibold ${submitting ? 'text-on-disabled' : 'text-on-brand'}`}>
          {submitting ? 'Đang đăng ký...' : 'Tiếp tục đăng ký'}
        </Text>
      </Pressable>

      <Pressable
        onPress={onBack}
        disabled={submitting}
        accessibilityRole="button"
        className="mt-3 min-h-12 items-center justify-center px-2 py-3">
        <Text className="text-center text-sm text-muted-foreground">
          Đã có tài khoản? <Text className="font-semibold text-primary">Đăng nhập</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  );
}
