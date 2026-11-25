import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/Screen';
import ThemeSelector from '@/components/ThemeSelector';

// shortcut: the app has no i18n, so only Vietnamese is selectable (web's picker is also
// local-only state); wire a real language setting here when translations exist.
const LANGUAGES = [
  { label: 'Tiếng Việt', available: true },
  { label: 'English', available: false },
];

export default function AppearanceSettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Giao diện" onBack={onBack} />
      <ScrollView contentContainerClassName="px-5 pb-10 pt-4 gap-6">
        <ThemeSelector framed={false} />
        <View accessibilityRole="radiogroup">
          <Text className="text-sm font-bold text-foreground">Ngôn ngữ hiển thị</Text>
          <View className="mt-2 rounded-2xl border border-border bg-surface p-4">
            <Text className="text-sm font-medium text-foreground">Thay đổi ngôn ngữ</Text>
            <Text className="text-xs text-muted-foreground">
              Áp dụng cho toàn bộ giao diện và thông báo
            </Text>
            <View className="mt-3 flex-row gap-2">
              {LANGUAGES.map(({ label, available }) => (
                <View
                  key={label}
                  accessibilityRole="radio"
                  accessibilityLabel={available ? label : `${label} (chưa hỗ trợ)`}
                  accessibilityState={{ checked: available, disabled: !available }}
                  className={`min-h-11 flex-1 items-center justify-center rounded-xl border px-2 py-2 ${available ? 'border-primary bg-primary-soft' : 'border-border bg-disabled'}`}>
                  <Text
                    className={`text-sm font-semibold ${available ? 'text-primary' : 'text-on-disabled'}`}>
                    {label}
                  </Text>
                  {available ? null : (
                    <Text className="text-[11px] text-on-disabled">Chưa hỗ trợ</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
