import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

export type MainTab = 'home' | 'news' | 'messages' | 'profile';
type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { id: MainTab; icon: IconName; activeIcon: IconName; label: string }[] = [
  { id: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Trang chủ' },
  { id: 'news', icon: 'newspaper-outline', activeIcon: 'newspaper', label: 'Tin tức' },
  { id: 'messages', icon: 'chatbubble-outline', activeIcon: 'chatbubble', label: 'Tin nhắn' },
  { id: 'profile', icon: 'person-outline', activeIcon: 'person', label: 'Hồ sơ' },
];

export default function BottomTabBar({
  active,
  onSelect,
}: {
  active: MainTab;
  onSelect: (tab: MainTab) => void;
}) {
  return (
    <View className="flex-row border-t border-slate-200 bg-white px-4 py-2">
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            className="flex-1 items-center py-1"
            accessibilityRole="button"
            accessibilityLabel={tab.label}>
            <Ionicons
              name={selected ? tab.activeIcon : tab.icon}
              size={21}
              color={selected ? '#2563eb' : '#94a3b8'}
            />
            <Text
              className={`mt-0.5 text-xs font-semibold ${selected ? 'text-blue-600' : 'text-slate-500'}`}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
