import { useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { backendHealth } from '@/lib/backend-health';

// Same message and "Kiểm tra lại" action as the web BackendHealthGate. The app stays mounted underneath
// (an overlay, not a replacement) so a short outage does not throw away what the user was doing.
export default function BackendHealthGate({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(
    backendHealth.subscribe,
    backendHealth.getSnapshot,
    backendHealth.getSnapshot
  );

  return (
    <>
      {children}
      {status === 'unavailable' ? (
        <View className="absolute inset-0 z-50 bg-background" style={{ elevation: 50 }}>
          <SafeAreaView className="flex-1 items-center justify-center px-6">
            <View className="w-full max-w-md rounded-3xl border border-border bg-surface p-8">
              <Text className="mb-5 text-center text-xl font-bold text-primary">HomeSpace</Text>
              <View accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text className="text-center text-2xl font-semibold text-foreground">
                  Hệ thống tạm thời gián đoạn
                </Text>
                <Text className="mt-3 text-center leading-6 text-muted-foreground">
                  Hệ thống đang khởi động hoặc chưa sẵn sàng. Ứng dụng sẽ tự mở lại khi kết nối được
                  khôi phục.
                </Text>
              </View>
              <Pressable
                onPress={backendHealth.recheck}
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
