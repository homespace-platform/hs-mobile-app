import { Pressable, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import type { ManagementDestination, ManagementRole } from '@/lib/dashboard-navigation';

const tenantShortcuts = [
  { destination: 'tenant-appointments', title: 'Lịch đi xem', icon: 'calendar-outline' },
  { destination: 'tenant-requests', title: 'Yêu cầu đã gửi', icon: 'paper-plane-outline' },
  { destination: 'tenant-contracts', title: 'Hợp đồng đi thuê', icon: 'document-text-outline' },
  { destination: 'tenant-payments', title: 'Lịch sử thanh toán', icon: 'card-outline' },
] as const;

export default function ManagementOverview({
  role,
  onOpen,
}: {
  role: ManagementRole;
  onOpen: (destination: ManagementDestination) => void;
}) {
  const landlord = role === 'landlord';

  return (
    <View className="gap-4">
      <View className={`flex-row gap-3 ${landlord ? 'items-center' : 'items-start'}`}>
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary-soft">
          <Icon
            name={landlord ? 'business-outline' : 'key-outline'}
            size={22}
            className="text-primary"
          />
        </View>
        <View className="flex-1 gap-1">
          <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
            {landlord ? 'Dashboard chủ nhà' : 'Dashboard người thuê'}
          </Text>
          {!landlord ? (
            <Text className="text-sm leading-5 text-muted-foreground">
              Theo dõi lịch đi xem, yêu cầu đã gửi và tiến độ thuê.
            </Text>
          ) : null}
        </View>
      </View>

      {!landlord ? (
        <>
          <View className="rounded-2xl border border-border bg-surface px-4 py-5">
            <Text className="text-center text-sm font-semibold text-muted-foreground">
              Trang thống kê dành cho người đi thuê đang được xây dựng…
            </Text>
          </View>
          <View className="gap-2">
            {tenantShortcuts.map((item) => (
              <Pressable
                key={item.destination}
                accessibilityRole="button"
                onPress={() => onOpen(item.destination)}
                className="min-h-12 flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                  <Icon name={item.icon} size={20} className="text-primary" />
                </View>
                <Text className="flex-1 text-sm font-bold text-foreground">{item.title}</Text>
                <Icon name="arrow-forward-outline" size={17} className="text-muted-foreground" />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
