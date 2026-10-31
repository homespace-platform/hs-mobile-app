import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Avatar from '@/components/Avatar';
import { useDialog } from '@/components/AppDialog';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { validDate } from '@/lib/form-validation';
import { updateUserAvatar, updateUserProfile, type ProfileUpdate } from '@/services/userApi';
import { uploadFile } from '@/services/storageApi';
import type { UserProfileResponse } from '@/types/api';

export default function ProfileEditScreen({
  profile,
  onBack,
  onSaved,
}: {
  profile: UserProfileResponse;
  onBack: () => void;
  onSaved: () => void;
}) {
  const showDialog = useDialog();
  const [form, setForm] = useState<ProfileUpdate>({
    username: profile.username,
    email: profile.email,
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    phone: profile.phone || null,
    dob: profile.dob || null,
    gender: ['MALE', 'FEMALE', 'OTHER'].includes(profile.gender || '')
      ? (profile.gender as ProfileUpdate['gender'])
      : null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (busy) return;
    if (
      !/^[a-zA-Z0-9._-]{3,50}$/.test(form.username) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ||
      form.firstName.trim().length < 2 ||
      form.lastName.trim().length < 2 ||
      (form.dob && !validDate(form.dob))
    ) {
      setError(
        'Kiểm tra tên đăng nhập (3–50 ký tự), email, họ/tên (ít nhất 2 ký tự) và ngày sinh YYYY-MM-DD.'
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateUserProfile({
        ...form,
        username: form.username.trim(),
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone?.trim() || null,
        dob: form.dob || null,
      });
      onSaved();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  async function pickAvatar() {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Cần cấp quyền truy cập thư viện ảnh.');
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (picked.canceled) return;
      setBusy(true);
      const asset = picked.assets[0];
      const size = asset.fileSize ?? (await (await fetch(asset.uri)).blob()).size;
      const uploaded = await uploadFile(
        {
          uri: asset.uri,
          fileName: asset.fileName || 'avatar.jpg',
          contentType: asset.mimeType || 'image/jpeg',
          sizeBytes: size,
        },
        {
          purpose: 'USER_AVATAR',
          visibility: 'PUBLIC',
          referenceType: 'USER',
          referenceId: profile.id,
        }
      );
      await updateUserAvatar(uploaded.id);
      onSaved();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Chỉnh sửa hồ sơ" onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-10 pt-4">
        <View className="items-center">
          <Avatar uri={profile.avatarUrl} name={profile.username} size={80} />
        </View>
        <Button label="Đổi ảnh đại diện" onPress={pickAvatar} disabled={busy} />
        <ErrorNotice message={error} />
        {(['username', 'email', 'firstName', 'lastName', 'phone', 'dob'] as const).map((key) => (
          <Field
            key={key}
            label={
              {
                username: 'Tên đăng nhập',
                email: 'Email',
                firstName: 'Tên',
                lastName: 'Họ',
                phone: 'Điện thoại',
                dob: 'Ngày sinh (YYYY-MM-DD)',
              }[key]
            }
            value={form[key] || ''}
            onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
            autoCapitalize={key === 'email' || key === 'username' ? 'none' : 'sentences'}
            editable={!busy}
            keyboardType={
              key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'
            }
          />
        ))}
        <Text className="mt-4 font-semibold text-secondary">Giới tính</Text>
        <View className="mt-2 flex-row gap-2">
          {(['MALE', 'FEMALE', 'OTHER'] as const).map((value) => (
            <Pressable
              key={value}
              disabled={busy}
              onPress={() => setForm((current) => ({ ...current, gender: value }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: form.gender === value }}
              className={`min-h-12 flex-1 items-center justify-center rounded-xl border ${form.gender === value ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
              <Text className="text-foreground">
                {{ MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' }[value]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          label="Lưu hồ sơ"
          onPress={() =>
            showDialog('Cập nhật hồ sơ', 'Lưu các thay đổi vào tài khoản HomeSpace?', [
              { text: 'Quay lại', style: 'cancel' },
              { text: 'Lưu', onPress: () => void save() },
            ])
          }
          busy={busy}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
