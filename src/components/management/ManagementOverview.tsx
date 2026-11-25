import { Pressable, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import {
  MANAGEMENT_NAVIGATION,
  type ManagementDestination,
  type ManagementRole,
} from '@/lib/dashboard-navigation';

export default function ManagementOverview({
  role,
  onOpen,
}: {
  role: ManagementRole;
  onOpen: (destination: ManagementDestination) => void;
}) {
  const landlord = role === 'landlord';
  const menuItems = MANAGEMENT_NAVIGATION[role].flatMap((group) => group.items);

  return (
    <View className="gap-4">
      {!landlord ? (
        <View className="rounded-2xl border border-border bg-surface px-4 py-5">
          <Text className="text-center text-sm font-semibold text-muted-foreground">
            Trang thống kê dành cho người đi thuê đang được xây dựng…
          </Text>
        </View>
      ) : null}

      <View className="gap-2">
        {menuItems.map(({ id, icon, title }) => {
          if (id === 'dashboard') return null;

          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              onPress={() => onOpen(id)}
              className="min-h-12 flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-muted">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                <Icon name={icon} size={20} className="text-primary" />
              </View>
              <Text className="flex-1 text-sm font-bold text-foreground">{title}</Text>
              <Icon name="arrow-forward-outline" size={17} className="text-muted-foreground" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
