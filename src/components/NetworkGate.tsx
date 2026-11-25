import { useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { networkHealth } from '@/lib/network-health';
import { GOOD_TO_UNBLOCK } from '@/lib/network-health-monitor';

// Blocks the app while the user's own Internet is down or weak. An overlay (not a replacement) so the app
// underneath keeps its state, and above BackendHealthGate (z-50) if both are active.
export default function NetworkGate({ children }: { children: ReactNode }) {
  const { status, reason, goodStreak } = useSyncExternalStore(
    networkHealth.subscribe,
    networkHealth.getSnapshot,
    networkHealth.getSnapshot
  );
  const weak = reason === 'weak';

  return (
    <>
      {children}
      {status === 'offline' ? (
        <View className="absolute inset-0 z-[60] bg-background" style={{ elevation: 60 }}>
          <SafeAreaView className="flex-1 items-center justify-center px-6">
            <View className="w-full max-w-md rounded-3xl border border-border bg-surface p-8">
              <Text className="mb-5 text-center text-xl font-bold text-primary">HomeSpace</Text>
              <View accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text className="text-center text-2xl font-semibold text-foreground">
                  {weak ? 'Kết nối mạng không ổn định' : 'Mất kết nối mạng'}
                </Text>
                <Text className="mt-3 text-center leading-6 text-muted-foreground">
                  {weak
                    ? 'Đường truyền đang chậm hoặc chập chờn. Ứng dụng sẽ tự mở lại khi kết nối ổn định.'
                    : 'Không có kết nối Internet. Vui lòng kiểm tra Wi-Fi hoặc dữ liệu di động. Ứng dụng sẽ tự mở lại khi kết nối ổn định.'}
                </Text>
                {goodStreak > 0 ? (
                  <Text className="mt-3 text-center text-sm text-muted-foreground">
                    {`Đang xác nhận kết nối… ${goodStreak}/${GOOD_TO_UNBLOCK}`}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={networkHealth.recheck}
                accessibilityRole="button"
                className="mt-6 min-h-12 items-center justify-center rounded-xl bg-brand px-5">
                <Text className="font-semibold text-on-brand">Kiểm tra lại</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </>
  );
}
