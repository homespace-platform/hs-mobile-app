import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import { useDialog } from '@/components/AppDialog';
import { apiError } from '@/lib/api-error';
import {
  createKycSession,
  getKycStatus,
  hasPassword,
  savePassword,
  type KycStatus,
} from '@/services/userApi';

export default function AccountSecurityScreen({ onBack }: { onBack: () => void }) {
  const showDialog = useDialog();
  const [passwordExists, setPasswordExists] = useState<boolean | null>(null);
  const [kyc, setKyc] = useState<KycStatus | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [exists, identity] = await Promise.all([hasPassword(), getKycStatus()]);
      setPasswordExists(exists);
      setKyc(identity);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function update() {
    if (busy || passwordExists === null) return;
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[@#$%^&+=!]/.test(newPassword) ||
      newPassword !== confirmation ||
      (passwordExists && !oldPassword)
    ) {
      setError(
        'Mật khẩu cần ít nhất 8 ký tự, chữ hoa, số và ký tự @#$%^&+=!. Nhập đúng mật khẩu xác nhận và mật khẩu cũ.'
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savePassword(newPassword, passwordExists ? oldPassword : undefined);
      setOldPassword('');
      setNewPassword('');
      setConfirmation('');
      setPasswordExists(true);
      showDialog('Thành công', 'Đã lưu mật khẩu mới.', undefined, 'success');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const session = await createKycSession();
      await WebBrowser.openBrowserAsync(session.url);
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Bảo mật & định danh" onBack={onBack} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-10 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <ErrorNotice message={error} />
        {error ? <Button label="Thử tải lại" onPress={load} disabled={busy} /> : null}
        <View className="rounded-2xl border border-border bg-surface p-4">
          <Text className="text-lg font-bold text-foreground">Xác minh danh tính</Text>
          <Text className="mt-2 text-sm text-secondary">
            Trạng thái: {kyc?.status || 'Đang tải...'}
          </Text>
          {kyc?.rejectionReason ? (
            <Text className="mt-2 text-sm text-danger">{kyc.rejectionReason}</Text>
          ) : null}
          <Text className="mt-2 text-sm leading-5 text-muted-foreground">
            Cần xác minh danh tính để đặt lịch xem và gửi yêu cầu thuê. Trạng thái được lấy từ hệ
            thống định danh.
          </Text>
          {kyc && kyc.status !== 'VERIFIED' ? (
            <Button label="Tiếp tục xác minh danh tính" onPress={verify} busy={busy} />
          ) : null}
          <Button label="Kiểm tra trạng thái" onPress={load} disabled={busy || loading} />
        </View>
        {passwordExists !== null ? (
          <>
            <Text className="mt-6 text-lg font-bold text-foreground">
              {passwordExists ? 'Đổi mật khẩu' : 'Tạo mật khẩu'}
            </Text>
            {passwordExists ? (
              <Field
                label="Mật khẩu hiện tại"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!busy}
              />
            ) : null}
            <Field
              label="Mật khẩu mới"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
            <Field
              label="Nhập lại mật khẩu mới"
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
            <Button
              label="Lưu mật khẩu mới"
              onPress={() =>
                showDialog('Cập nhật mật khẩu', 'Lưu mật khẩu mới cho tài khoản?', [
                  { text: 'Quay lại', style: 'cancel' },
                  { text: 'Lưu', onPress: () => void update() },
                ])
              }
              busy={busy}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
