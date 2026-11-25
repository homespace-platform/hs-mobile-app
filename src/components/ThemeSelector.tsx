import { Pressable, Text, View } from 'react-native';

import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Hệ Thống' },
];

// Mirrors the web mini-screen: small chip, wide card, accent button.
function Preview({ value }: { value: ThemePreference }) {
  const card = value === 'dark' ? 'bg-preview-dark-card' : 'bg-preview-light-card';
  return (
    <View
      className="aspect-[16/10] w-full justify-between overflow-hidden rounded-xl border border-border bg-preview-light p-2"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {value === 'dark' ? <View className="absolute inset-0 bg-preview-dark" /> : null}
      {value === 'system' ? (
        <View className="absolute inset-0 flex-row">
          <View className="flex-1 bg-preview-light" />
          <View className="flex-1 bg-preview-dark" />
        </View>
      ) : null}
      <View className="h-2 w-4 rounded bg-preview-accent" />
      <View className={`h-3 w-12 rounded ${card}`} />
      <View className="h-3 w-8 self-end rounded bg-preview-accent" />
    </View>
  );
}

export default function ThemeSelector({ framed = true }: { framed?: boolean }) {
  const { preference, setPreference } = useTheme();
  return (
    <View
      className={framed ? 'mt-6 rounded-3xl border border-border bg-surface p-4' : undefined}
      accessibilityRole="radiogroup">
      <Text className="text-sm font-bold text-foreground">Chủ đề giao diện</Text>
      <View className="mt-3 flex-row gap-3">
        {OPTIONS.map(({ value, label }) => {
          const selected = preference === value;
          return (
            <Pressable
              key={value}
              onPress={() => setPreference(value)}
              accessibilityRole="radio"
              accessibilityLabel={`Giao diện ${label.toLowerCase()}`}
              accessibilityState={{ checked: selected }}
              className={`flex-1 items-center gap-2 rounded-2xl border-2 bg-surface p-3 ${selected ? 'border-primary' : 'border-border'}`}>
              <Preview value={value} />
              <View className="mt-1 flex-row items-center gap-1.5">
                <View
                  className={`h-3.5 w-3.5 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                  {selected ? <View className="h-1.5 w-1.5 rounded-full bg-background" /> : null}
                </View>
                <Text className="text-xs font-bold text-foreground">{label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
