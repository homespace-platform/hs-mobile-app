import { useEffect, useState, type ComponentProps } from 'react';
import Ionicons from '@/components/Icon';
import { Pressable, Text, View } from 'react-native';
import { getManagementAttentionCounts } from '@/services/managementApi';

export type MainTab = 'home' | 'search' | 'management' | 'messages' | 'profile';
type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { id: MainTab; icon: IconName; activeIcon: IconName; label: string }[] = [
  { id: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Trang chủ' },
  { id: 'search', icon: 'search-outline', activeIcon: 'search', label: 'Tìm nhà' },
  { id: 'management', icon: 'grid-outline', activeIcon: 'grid', label: 'Quản lý' },
  { id: 'messages', icon: 'chatbubble-outline', activeIcon: 'chatbubble', label: 'Tin nhắn' },
  { id: 'profile', icon: 'person-outline', activeIcon: 'person', label: 'Hồ sơ' },
];

export default function BottomTabBar({
  active,
  onSelect,
  attentionVersion = 0,
}: {
  active: MainTab;
  onSelect: (tab: MainTab) => void;
  attentionVersion?: number;
}) {
  const [hasManagementAttention, setHasManagementAttention] = useState(false);
  useEffect(() => {
    let active = true;
    void getManagementAttentionCounts(attentionVersion > 0).then((counts) => {
      if (active)
        setHasManagementAttention(Object.values(counts).some((count) => (count ?? 0) > 0));
    });
    return () => {
      active = false;
    };
  }, [attentionVersion]);

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
            accessibilityLabel={
              tab.id === 'management' && hasManagementAttention
                ? `${tab.label}, có mục đang chờ xử lý`
                : tab.label
            }>
            <View className="relative h-6 w-6 items-center justify-center">
              <Ionicons
                name={selected ? tab.activeIcon : tab.icon}
                size={21}
                className={selected ? 'text-primary' : 'text-subtle'}
              />
              {tab.id === 'management' && hasManagementAttention ? (
                <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-danger" />
              ) : null}
            </View>
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
