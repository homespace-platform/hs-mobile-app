import { Pressable, Text, View } from 'react-native';

import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Hệ thống' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

export default function ThemeSelector() {
  const { preference, setPreference } = useTheme();
  return (
    <View className="mt-6 rounded-3xl border border-border bg-surface p-4">
      <Text className="text-base font-bold text-foreground">Giao diện</Text>
      <Text className="mt-1 text-xs text-muted-foreground">
        Chọn giao diện hoặc tự động theo thiết bị.
      </Text>
      <View className="mt-3 flex-row gap-2">
        {OPTIONS.map(({ value, label }) => (
          <Pressable
            key={value}
            onPress={() => setPreference(value)}
            accessibilityRole="radio"
            accessibilityLabel={`Giao diện ${label.toLowerCase()}`}
            accessibilityState={{ checked: preference === value }}
            className={`min-h-12 flex-1 items-center justify-center rounded-xl border px-2 py-3 ${preference === value ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
            <Text
              className={`text-sm font-semibold ${preference === value ? 'text-primary' : 'text-secondary'}`}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
