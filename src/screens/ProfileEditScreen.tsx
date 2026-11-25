import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Avatar from '@/components/Avatar';
import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import AddressEditor from '@/components/settings/AddressEditor';
import AvatarGalleryModal, { type AvatarItem } from '@/components/settings/AvatarGalleryModal';
import { apiError } from '@/lib/api-error';
import {
  avatarFileError,
  avatarMimeType,
  formatInstant,
  formatRole,
  isProfileDirty,
  normalizeProfileForm,
  profileFullName,
  profileToForm,
  validateProfileForm,
} from '@/lib/profile-form';
import { getUserProfileApi, updateUserAvatar, updateUserProfile } from '@/services/userApi';
import { refreshOnboarding } from '@/lib/onboarding-store';
import type { ProfileUpdate } from '@/services/userApi';
import { getStorageViewUrl, listUserAvatars, uploadFile } from '@/services/storageApi';
import type { UserProfileResponse } from '@/types/api';

function ReadOnlyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="mt-2 rounded-xl border border-border bg-muted px-3.5 py-2.5">
      <Text className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</Text>
      <Text selectable className={`mt-1 text-xs text-foreground ${mono ? 'font-mono' : ''}`}>
        {value}
      </Text>
    </View>
  );
}

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
  const [current, setCurrent] = useState(profile);
  const [baseline, setBaseline] = useState(() => profileToForm(profile));
  const [form, setForm] = useState<ProfileUpdate>(() => profileToForm(profile));
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [gallery, setGallery] = useState<{
    items: AvatarItem[];
    index: number;
    error: string | null;
  } | null>(null);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const changed = useRef(false);

  const errors = validateProfileForm(form);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isProfileDirty(form, baseline);
  const fullName = profileFullName(form);
  const busy = saving || avatarBusy;

  // Reload the profile; syncForm resets the form only after a profile save so unsaved edits survive avatar/address changes.
  async function refresh(syncForm = false) {
    try {
      const next = await getUserProfileApi(true);
      setCurrent(next);
      if (syncForm) {
        setBaseline(profileToForm(next));
        setForm(profileToForm(next));
      }
      setRefreshFailed(false);
    } catch {
      setRefreshFailed(true);
    }
  }

  async function save() {
    if (busy || !dirty || hasErrors) return;
    const payload = normalizeProfileForm(form);
    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(payload);
      void refreshOnboarding();
      changed.current = true;
      setBaseline(payload);
      setForm(payload);
      showDialog('Thành công', 'Cập nhật thông tin cá nhân thành công!', undefined, 'success');
      await refresh(true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  async function pickAvatar() {
    if (busy) return;
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Cần cấp quyền truy cập thư viện ảnh.');
      // The system picker crops to 1:1 (no crop library is installed); web crops to 512px WebP.
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const contentType = avatarMimeType(asset.mimeType, asset.fileName ?? asset.uri);
      const size = asset.fileSize ?? (await (await fetch(asset.uri)).blob()).size;
      const invalid = avatarFileError(contentType, size);
      if (invalid) throw new Error(invalid);
      setAvatarBusy(true);
      const uploaded = await uploadFile(
        {
          uri: asset.uri,
          fileName: asset.fileName || 'avatar.jpg',
          contentType,
          sizeBytes: size,
        },
        {
          purpose: 'USER_AVATAR',
          visibility: 'PUBLIC',
          referenceType: 'USER',
          referenceId: current.id,
        }
      );
      await updateUserAvatar(uploaded.id);
      changed.current = true;
      showDialog('Thành công', 'Cập nhật ảnh đại diện thành công!', undefined, 'success');
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function openGallery() {
    if (loadingGallery) return;
    setLoadingGallery(true);
    setError(null);
    try {
      const objects = await listUserAvatars(current.id);
      const items = await Promise.all(
        objects.map(async (object) => ({ id: object.id, url: await getStorageViewUrl(object.id) }))
      );
      const index = items.findIndex((item) => item.id === current.avatarStorageId);
      setGallery({ items, index: Math.max(index, 0), error: null });
    } catch (e) {
      setError(apiError(e) || 'Không thể tải lịch sử ảnh đại diện.');
    } finally {
      setLoadingGallery(false);
    }
  }

  async function reuseAvatar(storageId: string) {
    if (avatarBusy || storageId === current.avatarStorageId) return;
    setAvatarBusy(true);
    setGallery((state) => state && { ...state, error: null });
    try {
      await updateUserAvatar(storageId);
      changed.current = true;
      setGallery(null);
      showDialog('Thành công', 'Đã đặt lại ảnh đại diện thành công!', undefined, 'success');
      await refresh();
    } catch (e) {
      setGallery((state) => state && { ...state, error: apiError(e) });
    } finally {
      setAvatarBusy(false);
    }
  }

  const back = () => (changed.current ? onSaved() : onBack());
  const field = (
    key: 'firstName' | 'lastName' | 'username' | 'phone' | 'email',
    label: string
  ) => (
    <View key={key}>
      <Field
        label={label}
        value={form[key] ?? ''}
        onChangeText={(value) =>
          setForm((state) => ({
            ...state,
            [key]: key === 'phone' ? value || null : value,
          }))
        }
        autoCapitalize={key === 'firstName' || key === 'lastName' ? 'words' : 'none'}
        autoCorrect={false}
        editable={!busy}
        keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'}
      />
      {errors[key] ? (
        <Text accessibilityRole="alert" className="mt-1 text-xs font-medium text-danger">
          {errors[key]}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Chỉnh sửa hồ sơ" onBack={back} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-10 pt-4">
        <ErrorNotice message={error} />
        {refreshFailed ? (
          <View className="mb-3 flex-row items-center rounded-xl bg-warning-soft p-3">
            <Text className="flex-1 text-sm text-warning">
              Chưa tải lại được dữ liệu mới nhất từ máy chủ.
            </Text>
            <Pressable onPress={() => void refresh(!dirty)} accessibilityRole="button">
              <Text className="px-2 text-xs font-bold text-primary">Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row items-center rounded-2xl border border-border bg-surface p-4">
          <View>
            <Pressable
              onPress={() => void openGallery()}
              disabled={loadingGallery}
              accessibilityRole="button"
              accessibilityLabel="Xem ảnh đại diện">
              <Avatar uri={current.avatarUrl} name={fullName} size={72} />
              {loadingGallery ? (
                <View className="absolute inset-0 items-center justify-center rounded-full bg-overlay">
                  <ActivityIndicator className="text-on-inverse" />
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => void pickAvatar()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Thay đổi ảnh đại diện"
              accessibilityState={{ busy: avatarBusy }}
              className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full border border-border bg-surface">
              {avatarBusy ? (
                <ActivityIndicator size="small" className="text-foreground" />
              ) : (
                <Icon name="camera" size={16} className="text-foreground" />
              )}
            </Pressable>
          </View>
          <View className="ml-4 flex-1">
            <View className="flex-row items-center">
              <Text numberOfLines={2} className="shrink text-base font-bold text-foreground">
                {fullName}
              </Text>
              {current.role === 'ADMIN' ? (
                <View
                  accessibilityLabel="Quản trị viên"
                  className="ml-1.5 h-[18px] w-[18px] items-center justify-center rounded-full bg-warning-soft">
                  <Icon name="ribbon" size={11} className="text-warning" />
                </View>
              ) : current.kycVerified ? (
                <View
                  accessibilityLabel="Đã xác minh danh tính"
                  className="ml-1.5 h-[18px] w-[18px] items-center justify-center rounded-full bg-brand">
                  <Icon name="checkmark" size={11} className="text-on-brand" />
                </View>
              ) : null}
            </View>
            <Text className="mt-1 text-xs text-muted-foreground">{form.email}</Text>
            {current.kycVerified ? (
              <View className="mt-2 flex-row items-center self-start rounded-xl bg-success-soft px-2.5 py-2">
                <Icon name="shield-checkmark" size={14} className="text-success" />
                <Text className="ml-1.5 text-[11px] font-medium text-success">
                  Tài khoản này đã xác minh danh tính
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
          {field('firstName', 'Tên')}
          {field('lastName', 'Họ')}
          {field('username', 'Tên đăng nhập')}
          {field('phone', 'Số điện thoại')}
          {field('email', 'Email')}
          <Button
            label={saving ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
            onPress={() => void save()}
            busy={saving}
            disabled={!dirty || hasErrors || avatarBusy}
          />
        </View>

        <AddressEditor
          initialAddress={current.address}
          onSaved={() => {
            changed.current = true;
            return refresh();
          }}
        />

        <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
            Thông tin hệ thống
          </Text>
          <Text className="mt-0.5 text-[11px] text-muted-foreground">
            Dữ liệu chỉ đọc được đồng bộ từ tài khoản backend.
          </Text>
          <ReadOnlyField label="User ID" value={current.id} mono />
          <ReadOnlyField label="Role ID" value={current.roleId || 'Chưa được gán'} mono />
          <ReadOnlyField label="Vai trò" value={formatRole(current.role)} />
          <ReadOnlyField
            label="Onboarding"
            value={current.onBoarded ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
          />
          <ReadOnlyField
            label="Trạng thái tài khoản"
            value={current.active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
          />
          <ReadOnlyField label="Ngày tạo" value={formatInstant(current.createdAt)} />
          <ReadOnlyField label="Cập nhật gần nhất" value={formatInstant(current.updatedAt)} />
        </View>
      </ScrollView>
      <AvatarGalleryModal
        visible={gallery !== null}
        title={`Ảnh đại diện - ${fullName}`}
        items={gallery?.items ?? []}
        currentId={current.avatarStorageId}
        initialIndex={gallery?.index ?? 0}
        fallbackUri={current.avatarUrl}
        name={fullName}
        restoring={avatarBusy}
        error={gallery?.error ?? null}
        onClose={() => setGallery(null)}
        onUse={(id) => void reuseAvatar(id)}
      />
    </SafeAreaView>
  );
}
