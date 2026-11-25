import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { firstGateSection, missingItems } from '@/lib/profile-gate';
import { openSettings } from '@/lib/profile-gate-signal';
import { useOnboarding } from '@/lib/use-onboarding';

// Counterpart of web ProfileCompletionBanner: shown under the header of the main tabs while the profile is incomplete.
export default function ProfileCompletionBanner() {
  const { onboarding } = useOnboarding();
  const items = missingItems(onboarding?.missing ?? []);
  if (!items.length) return null;

  // null when nothing missing can be completed on mobile (only KYC for now): the button is hidden.
  const section = firstGateSection(items.map((item) => item.code));

  return (
    <View
      accessibilityRole="alert"
      className="items-center border-b border-warning/40 bg-warning-soft px-4 py-2">
      <View className="flex-row items-start">
        <Icon name="warning-outline" size={16} className="mt-0.5 text-warning" />
        <Text className="ml-1.5 flex-1 text-xs leading-4 text-warning">
          <Text className="font-bold">Hoàn thiện hồ sơ để sử dụng dịch vụ HomeSpace: </Text>
          {items.map((item) => item.label).join(', ')}.
        </Text>
      </View>
      {section ? (
        <Pressable
          onPress={() => openSettings(section)}
          accessibilityRole="button"
          hitSlop={10}
          className="mt-1 min-h-7 justify-center px-3">
          <Text className="text-xs font-bold text-warning underline">Cập nhật thông tin</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
