import type { ComponentProps } from 'react';
import Ionicons from '@/components/Icon';
import { Pressable, Text, View } from 'react-native';

export type MainTab = 'home' | 'news' | 'management' | 'messages' | 'profile';
type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { id: MainTab; icon: IconName; activeIcon: IconName; label: string }[] = [
  { id: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Trang chủ' },
  { id: 'news', icon: 'newspaper-outline', activeIcon: 'newspaper', label: 'Tin tức' },
  { id: 'management', icon: 'grid-outline', activeIcon: 'grid', label: 'Quản lý' },
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
    <View className="flex-row border-t border-border bg-surface px-4 py-2">
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
              className={selected ? 'text-primary' : 'text-subtle'}
            />
            <Text
              className={`mt-0.5 text-xs font-semibold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
