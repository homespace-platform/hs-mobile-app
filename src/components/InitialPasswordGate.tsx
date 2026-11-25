import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { Button, ErrorNotice } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { onboardingStore, refreshOnboarding } from '@/lib/onboarding-store';
import { useOnboarding } from '@/lib/use-onboarding';
import { savePassword } from '@/services/userApi';

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm font-semibold text-secondary">{label}</Text>
      <View className="flex-row items-center rounded-xl border border-border bg-surface">
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 px-4 py-3 text-foreground selection:text-primary placeholder:text-subtle"
        />
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="h-12 w-12 items-center justify-center">
          <Icon
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            className="text-muted-foreground"
          />
        </Pressable>
      </View>
    </View>
  );
}

// Counterpart of web OnboardingInitializer: blocks the app until a first password is created
// (social-login accounts have none). Everything else is completed later in Settings.
export default function InitialPasswordGate() {
  const showDialog = useDialog();
  const { onboarding } = useOnboarding();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (onboarding?.passwordSet !== false) return null;

  async function submit() {
    if (saving) return;
    if (password.length < 8) return setError('Mật khẩu phải có tối thiểu 8 ký tự.');
    if (password !== confirm) return setError('Mật khẩu xác nhận không khớp.');
    setError(null);
    setSaving(true);
    try {
      await savePassword(password);
      // Close the gate first (a refresh failure must not trap the user), then confirm, then re-sync.
      onboardingStore.markPasswordSet();
      setPassword('');
      setConfirm('');
      showDialog('Thành công', 'Tạo mật khẩu thành công.', undefined, 'success');
      void refreshOnboarding();
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    // No onRequestClose action: the Android back button must not dismiss the gate.
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-overlay/65">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow items-center justify-center px-5 py-8">
          <View
            accessibilityViewIsModal
            className="w-full max-w-md rounded-3xl border border-border bg-surface p-5">
            <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
              Chào mừng bạn đến với HomeSpace
            </Text>
            <View className="mt-3 rounded-2xl bg-primary-soft p-3">
              <Text className="text-sm font-bold text-primary">Tạo mật khẩu</Text>
              <Text className="mt-1 text-sm leading-5 text-secondary">
                Vui lòng tạo mật khẩu để tiếp tục. Các thông tin khác bạn có thể cập nhật sau trong
                phần Cài đặt.
              </Text>
            </View>
            <Text className="mt-3 text-sm leading-5 text-muted-foreground">
              Tài khoản đăng nhập mạng xã hội chưa có mật khẩu. Hãy tạo mật khẩu để có thể đăng nhập
              bằng email, username hoặc số điện thoại.
            </Text>
            <PasswordField
              label="Mật khẩu mới"
              value={password}
              onChange={setPassword}
              visible={visible}
              onToggle={() => setVisible((v) => !v)}
            />
            <PasswordField
              label="Xác nhận mật khẩu"
              value={confirm}
              onChange={setConfirm}
              visible={visible}
              onToggle={() => setVisible((v) => !v)}
            />
            <ErrorNotice message={error} />
            <Button
              label={saving ? 'Đang lưu...' : 'Tạo mật khẩu'}
              onPress={submit}
              busy={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
