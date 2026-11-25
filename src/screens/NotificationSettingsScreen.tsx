import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { PolicyNotice } from '@/components/PolicyDialog';
import { ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import {
  getPushStatus,
  isPhysicalDevice,
  registerPushDevice,
  unregisterPushDevice,
  type PushStatus,
} from '@/lib/push/device';
import {
  NOTIFICATION_SETTINGS_META,
  type NotificationCategory,
  type NotificationPreferenceItem,
} from '@/lib/notification';
import {
  getNotificationPreferences,
  patchNotificationPreference,
} from '@/services/notificationSettingsApi';

type IconName = ComponentProps<typeof Icon>['name'];
const ICONS: Record<NotificationCategory, IconName> = {
  NEWS: 'newspaper-outline',
  SYSTEM: 'notifications-outline',
  ACCOUNT: 'person-circle-outline',
  LISTING: 'business-outline',
  APPOINTMENT: 'calendar-outline',
  RENTAL_REQUEST: 'key-outline',
  CONTRACT: 'shield-checkmark-outline',
  PAYMENT: 'card-outline',
  CHAT: 'chatbubble-outline',
};

const PERMISSION_LABELS = {
  granted: 'Đã cấp',
  denied: 'Bị từ chối',
  undetermined: 'Chưa hỏi',
} as const;

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View className="mt-2 flex-row items-center justify-between">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <View className={`rounded-full px-2.5 py-0.5 ${ok ? 'bg-success-soft' : 'bg-warning-soft'}`}>
        <Text className={`text-xs font-bold ${ok ? 'text-success' : 'text-warning'}`}>{value}</Text>
      </View>
    </View>
  );
}

// Push on THIS device: permission + registration state, with enable/disable and system settings.
function DevicePushCard() {
  const showDialog = useDialog();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    let current = await getPushStatus();
    // Opening the screen re-checks the registration silently (idempotent, never prompts).
    if (current.supported && current.permission === 'granted' && !current.optedOut) {
      if (!current.registered) await registerPushDevice();
      current = await getPushStatus();
    }
    setStatus(current);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await registerPushDevice({ userInitiated: true });
      if (result === 'error')
        showDialog(
          'Không thể bật thông báo',
          'Không đăng ký được thiết bị. Kiểm tra kết nối mạng, Google Play services rồi thử lại.'
        );
      else if (result === 'denied')
        showDialog(
          'Chưa có quyền thông báo',
          'Hãy cấp quyền thông báo cho HomeSpace trong cài đặt hệ thống.'
        );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      await unregisterPushDevice({ optOut: true });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const active = !!status && status.registered && status.permission === 'granted';
  return (
    <View className="mb-5 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-2xl border border-primary-border bg-primary-soft">
          <Icon name="phone-portrait-outline" size={20} className="text-primary" />
        </View>
        <Text className="ml-3 flex-1 text-sm font-bold text-foreground">
          Thông báo trên thiết bị này
        </Text>
        {!status || busy ? <ActivityIndicator size="small" className="text-primary" /> : null}
      </View>
      {status && !status.supported ? (
        <Text className="mt-3 text-xs leading-5 text-muted-foreground">
          Thông báo đẩy khi đã tắt ứng dụng chưa hỗ trợ trên iOS. Bạn vẫn nhận thông báo trong ứng
          dụng khi đang mở.
        </Text>
      ) : status ? (
        <>
          <StatusRow
            label="Quyền thông báo"
            value={PERMISSION_LABELS[status.permission]}
            ok={status.permission === 'granted'}
          />
          <StatusRow
            label="Thiết bị"
            value={status.registered ? 'Đã đăng ký' : status.optedOut ? 'Đã tắt' : 'Chưa đăng ký'}
            ok={status.registered}
          />
          <View className="mt-3 flex-row flex-wrap gap-2">
            {active ? (
              <Pressable
                onPress={() => void disable()}
                disabled={busy}
                accessibilityRole="button"
                className={`min-h-11 justify-center rounded-xl border border-border bg-surface px-4 ${busy ? 'opacity-50' : ''}`}>
                <Text className="text-sm font-semibold text-foreground">Tắt</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void enable()}
                disabled={busy}
                accessibilityRole="button"
                className={`min-h-11 justify-center rounded-xl bg-brand px-4 ${busy ? 'opacity-50' : ''}`}>
                <Text className="text-sm font-semibold text-on-brand">Bật</Text>
              </Pressable>
            )}
            {status.permission === 'denied' ? (
              <Pressable
                onPress={() => void Linking.openSettings()}
                accessibilityRole="button"
                className="min-h-11 justify-center rounded-xl border border-border bg-surface px-4">
                <Text className="text-sm font-semibold text-foreground">Mở cài đặt hệ thống</Text>
              </Pressable>
            ) : null}
          </View>
          <Text className="mt-3 text-xs leading-5 text-muted-foreground">
            Nếu máy có trình tiết kiệm pin, hãy cho phép HomeSpace chạy nền/tự khởi động để nhận
            thông báo khi đã tắt ứng dụng.
            {isPhysicalDevice ? '' : ' Máy ảo cần có Google Play.'}
          </Text>
        </>
      ) : null}
    </View>
  );
}

export default function NotificationSettingsScreen({ onBack }: { onBack: () => void }) {
  const showDialog = useDialog();
  const [items, setItems] = useState<NotificationPreferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<NotificationCategory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getNotificationPreferences());
    } catch (cause) {
      setItems([]);
      setError(apiError(cause) || 'Không thể tải cài đặt thông báo.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Auto-save like web: optimistic, one category at a time, revert + dialog on failure.
  async function togglePush(category: NotificationCategory, value: boolean) {
    if (saving) return;
    const previous = items;
    setItems(items.map((item) => (item.category === category ? { ...item, push: value } : item)));
    setSaving(category);
    try {
      setItems(await patchNotificationPreference(category, 'push', value));
    } catch (cause) {
      setItems(previous);
      showDialog('Không thể lưu cài đặt thông báo', apiError(cause));
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Thông báo" onBack={onBack} />
      <ScrollView contentContainerClassName="px-5 pb-10 pt-5">
        <DevicePushCard />
        <Text className="text-base font-bold text-foreground">Tùy chọn kênh nhận thông báo</Text>
        <PolicyNotice
          tone="neutral"
          className="mt-2"
          title="Tùy chọn kênh nhận thông báo"
          summary="Thông báo vẫn được lưu tại Trung tâm thông báo khi tắt các kênh này."
          text="Tùy chọn Push áp dụng cho cả popup trong ứng dụng và thông báo đẩy. Bạn có thể chọn kênh nhận theo từng danh mục. Thông báo vẫn được lưu tại Trung tâm thông báo khi tắt các kênh này."
        />
        {loading ? (
          <View className="my-8 flex-row items-center justify-center">
            <ActivityIndicator className="text-primary" />
            <Text className="ml-2 text-sm text-muted-foreground">
              Đang tải cài đặt thông báo...
            </Text>
          </View>
        ) : error ? (
          <View className="mt-4 rounded-2xl border border-danger bg-danger-soft p-4">
            <Text accessibilityRole="alert" className="text-sm font-semibold text-danger">
              {error}
            </Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              className="mt-3 min-h-11 items-center justify-center self-start rounded-xl bg-danger-solid px-4">
              <Text className="text-sm font-semibold text-on-danger-solid">Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
            {items.map((item, index) => {
              const meta = NOTIFICATION_SETTINGS_META[item.category];
              return (
                <View
                  key={item.category}
                  className={`p-4 ${index ? 'border-t border-border' : ''}`}>
                  <View className="flex-row items-start">
                    <View className="h-10 w-10 items-center justify-center rounded-2xl border border-primary-border bg-primary-soft">
                      <Icon name={ICONS[item.category]} size={20} className="text-primary" />
                    </View>
                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-sm font-bold text-foreground">{meta.title}</Text>
                        {saving === item.category ? (
                          <ActivityIndicator size="small" className="ml-2 text-primary" />
                        ) : null}
                      </View>
                      <Text className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {meta.description}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-3 flex-row items-center justify-end">
                    <Text className="mr-2 text-xs font-medium text-muted-foreground">Push</Text>
                    <Switch
                      value={item.push}
                      disabled={saving !== null}
                      accessibilityLabel={`${meta.title} - Push`}
                      onValueChange={(value) => void togglePush(item.category, value)}
                    />
                    <View className="ml-5 flex-row items-center opacity-60">
                      <Text className="mr-2 text-xs font-medium text-muted-foreground">
                        Email <Text className="text-[10px]">(Sắp có)</Text>
                      </Text>
                      <Switch
                        value={item.email}
                        disabled
                        accessibilityLabel={`${meta.title} - Email`}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
