import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import { useDialog } from '@/components/AppDialog';
import { PolicyNotice } from '@/components/PolicyDialog';
import { isAxiosError } from 'axios';
import { useAuth } from '@/features/auth/AuthProvider';
import { validatePasswordChange } from '@/lib/password';
import { apiError } from '@/lib/api-error';
import { hasPassword, savePassword } from '@/services/userApi';
import { getKycStatus, type KycStatusResponse } from '@/services/kycApi';
import { startKyc, subscribeKycFinished, useKycBusy } from '@/lib/kyc/client';
import { KYC_STATUS_LABELS } from '@/lib/kyc/pure';

export default function AccountSecurityScreen({ onBack }: { onBack: () => void }) {
  const showDialog = useDialog();
  const { logout } = useAuth();
  const [passwordExists, setPasswordExists] = useState<boolean | null>(null);
  const [kyc, setKyc] = useState<KycStatusResponse | null>(null);
  const kycBusy = useKycBusy();
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
  // Outcome of a KYC attempt (also from a cold-start link): show the fresh status.
  useEffect(() => subscribeKycFinished(() => void load()), [load]);
  async function update() {
    if (busy || passwordExists === null) return;
    const invalid = validatePasswordChange(oldPassword, newPassword, confirmation, passwordExists);
    if (invalid) {
      setError(invalid);
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
      if (passwordExists) {
        // Web signs out after a password change so every session re-authenticates.
        showDialog(
          'Thành công',
          'Đổi mật khẩu thành công. Đang đăng xuất...',
          undefined,
          'success'
        );
        setTimeout(() => void logout(), 800);
      } else showDialog('Thành công', 'Đã tạo mật khẩu mới.', undefined, 'success');
    } catch (e) {
      const message = isAxiosError<{ message?: string }>(e) ? e.response?.data?.message : null;
      setError(
        typeof message === 'string' && message.trim()
          ? message
          : isAxiosError(e) && e.response
            ? 'Không thể đổi mật khẩu. Vui lòng thử lại.'
            : apiError(e)
      );
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
            Trạng thái: {kyc ? (KYC_STATUS_LABELS[kyc.status] ?? kyc.status) : 'Đang tải...'}
          </Text>
          {kyc?.rejectionReason ? (
            <Text className="mt-2 text-sm text-danger">{kyc.rejectionReason}</Text>
          ) : null}
          <PolicyNotice
            tone="neutral"
            className="mt-2"
            title="Xác minh danh tính"
            summary="Cần xác minh danh tính để đặt lịch xem và gửi yêu cầu thuê."
            text="Cần xác minh danh tính để đặt lịch xem và gửi yêu cầu thuê. Trạng thái được lấy từ hệ thống định danh."
          />
          {kyc && kyc.status !== 'VERIFIED' && kyc.status !== 'REVIEW_REQUIRED' ? (
            <Button
              label={kyc.status === 'NOT_VERIFIED' ? 'Bắt đầu xác minh' : 'Thử lại xác minh'}
              onPress={() => void startKyc()}
              busy={kycBusy}
              disabled={busy}
            />
          ) : null}
          <Button
            label="Kiểm tra trạng thái"
            onPress={load}
            disabled={busy || loading || kycBusy}
          />
        </View>
        {passwordExists !== null ? (
          <>
            <Text className="mt-6 text-lg font-bold text-foreground">
              {passwordExists ? 'Đổi mật khẩu' : 'Tạo mật khẩu'}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              Để bảo vệ tài khoản, hãy sử dụng mật khẩu mạnh bao gồm chữ hoa, chữ thường và số.
            </Text>
            {passwordExists ? (
              <Field
                label="Mật khẩu hiện tại"
                placeholder="Nhập mật khẩu hiện tại"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!busy}
              />
            ) : null}
            <Field
              label="Mật khẩu mới"
              placeholder="Tối thiểu 8 ký tự, có chữ hoa, số và ký tự đặc biệt"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
            <Field
              label="Xác nhận mật khẩu mới"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
            <Button
              label="Lưu mật khẩu mới"
              onPress={() =>
                showDialog(
                  passwordExists ? 'Đổi mật khẩu' : 'Tạo mật khẩu',
                  passwordExists
                    ? 'Sau khi đổi mật khẩu, bạn sẽ được đăng xuất. Tiếp tục?'
                    : 'Lưu mật khẩu mới cho tài khoản?',
                  [
                    { text: 'Quay lại', style: 'cancel' },
                    { text: 'Lưu', onPress: () => void update() },
                  ]
                )
              }
              busy={busy}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
