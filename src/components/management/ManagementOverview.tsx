import { Pressable, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { LandlordSummaryView, TenantSummaryView } from './DashboardSummary';
import {
  MANAGEMENT_NAVIGATION,
  type ManagementDestination,
  type ManagementRole,
} from '@/lib/dashboard-navigation';

export default function ManagementOverview({
  role,
  onOpen,
  onAction,
}: {
  role: ManagementRole;
  onOpen: (destination: ManagementDestination) => void;
  onAction: (href: string) => void;
}) {
  const menuItems = MANAGEMENT_NAVIGATION[role].flatMap((group) => group.items);

  return (
    <View className="gap-4">
      {role === 'landlord' ? (
        <LandlordSummaryView key={role} onAction={onAction} />
      ) : (
        <TenantSummaryView key={role} onAction={onAction} />
      )}
      <Text accessibilityRole="header" className="text-base font-bold text-foreground">
        Truy cập nhanh
      </Text>
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
  );
}
