import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import type { ManagementDestination, ManagementRole } from '@/lib/dashboard-navigation';

type IconName = ComponentProps<typeof Icon>['name'];

const membershipMetrics = [
  {
    label: 'Lượt đăng khả dụng',
    description: 'Dùng để gửi duyệt tin mới hoặc đăng lại tin hết hạn.',
    icon: 'checkmark-circle-outline',
    iconColor: 'text-success',
  },
  {
    label: 'Lượt đang giữ chỗ',
    description: 'Số lượt đang tạm giữ cho các bài đăng chờ duyệt.',
    icon: 'layers-outline',
    iconColor: 'text-primary',
  },
  {
    label: 'Thời hạn hiệu lực gói',
    description: 'Tin đã hiển thị vẫn duy trì tới hết hạn riêng của tin.',
    icon: 'time-outline',
    iconColor: 'text-warning',
  },
] as const;

const shortcuts: Record<
  ManagementRole,
  {
    destination: ManagementDestination;
    title: string;
    icon: IconName;
    description?: string;
    iconBackground?: string;
    iconColor?: string;
  }[]
> = {
  landlord: [
    {
      destination: 'landlord-properties',
      title: 'Quản lý tin đăng',
      description: 'Xem tin đang hiển thị, tin nháp và tin hết hạn.',
      icon: 'document-text-outline',
      iconBackground: 'bg-primary-soft',
      iconColor: 'text-primary',
    },
    {
      destination: 'landlord-appointments',
      title: 'Lịch xem nhà',
      description: 'Quản lý lịch hẹn xem nhà của khách thuê.',
      icon: 'calendar-outline',
      iconBackground: 'bg-warning-soft',
      iconColor: 'text-warning',
    },
    {
      destination: 'landlord-requests',
      title: 'Yêu cầu thuê',
      description: 'Theo dõi hồ sơ thuê, đặt cọc giữ chỗ và hợp đồng.',
      icon: 'paper-plane-outline',
      iconBackground: 'bg-success-soft',
      iconColor: 'text-success',
    },
  ],
  tenant: [
    { destination: 'tenant-appointments', title: 'Lịch đi xem', icon: 'calendar-outline' },
    { destination: 'tenant-requests', title: 'Yêu cầu đã gửi', icon: 'paper-plane-outline' },
    { destination: 'tenant-contracts', title: 'Hợp đồng đi thuê', icon: 'document-text-outline' },
    { destination: 'tenant-payments', title: 'Lịch sử thanh toán', icon: 'card-outline' },
  ],
};

function MembershipOverview() {
  return (
    <View className="gap-4 rounded-3xl border border-border bg-surface p-4">
      <View className="flex-row items-start gap-3 border-b border-border pb-4">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand">
          <Icon name="ribbon-outline" size={23} className="text-on-brand" />
        </View>
        <View className="flex-1 gap-1">
          <Text accessibilityRole="header" className="text-sm font-bold text-muted-foreground">
            Gói đang kích hoạt
          </Text>
          <Text className="text-lg font-bold text-foreground">Chưa có dữ liệu</Text>
        </View>
      </View>

      <View className="gap-2">
        {membershipMetrics.map((metric) => (
          <View key={metric.label} className="gap-1 rounded-2xl border border-border bg-muted p-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm font-semibold text-muted-foreground">
                {metric.label}
              </Text>
              <Icon name={metric.icon} size={18} className={metric.iconColor} />
            </View>
            <Text
              accessibilityLabel="Chưa có dữ liệu"
              className="text-xl font-bold text-foreground">
              —
            </Text>
            <Text className="text-xs text-muted-foreground">{metric.description}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-start gap-2 rounded-xl bg-primary-soft p-3">
        <Icon name="information-circle-outline" size={20} className="text-primary" />
        <Text className="flex-1 text-sm text-primary">
          Lưu nháp miễn phí. Chỉ trừ lượt khi gửi duyệt hoặc đăng lại.
        </Text>
      </View>
    </View>
  );
}

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
      <View className="flex-row items-start gap-3">
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
          <Text className="text-sm leading-5 text-muted-foreground">
            {landlord
              ? 'Theo dõi gói hội viên, hạn mức lượt đăng tin, quản lý bài đăng và yêu cầu thuê nhà.'
              : 'Theo dõi lịch đi xem, yêu cầu đã gửi và tiến độ thuê.'}
          </Text>
        </View>
      </View>

      {landlord ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpen('landlord-membership')}
              className="min-h-12 flex-row items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
              <Icon name="ribbon-outline" size={18} className="text-primary" />
              <Text className="text-sm font-bold text-foreground">Gói hội viên & Bảng giá</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpen('landlord-create-listing')}
              className="min-h-12 flex-row items-center gap-2 rounded-xl bg-brand px-3 py-2">
              <Icon name="add-circle-outline" size={18} className="text-on-brand" />
              <Text className="text-sm font-bold text-on-brand">Đăng tin mới</Text>
            </Pressable>
          </View>
          <MembershipOverview />
        </>
      ) : (
        <View className="rounded-2xl border border-border bg-surface px-4 py-5">
          <Text className="text-center text-sm font-semibold text-muted-foreground">
            Trang thống kê dành cho người đi thuê đang được xây dựng…
          </Text>
        </View>
      )}

      <View className="gap-2">
        {shortcuts[role].map((item) => (
          <Pressable
            key={item.destination}
            accessibilityRole="button"
            onPress={() => onOpen(item.destination)}
            className="min-h-12 flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
            <View
              className={`h-10 w-10 items-center justify-center rounded-xl ${item.iconBackground ?? 'bg-primary-soft'}`}>
              <Icon name={item.icon} size={20} className={item.iconColor ?? 'text-primary'} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-bold text-foreground">{item.title}</Text>
              {item.description ? (
                <Text className="text-xs leading-5 text-muted-foreground">{item.description}</Text>
              ) : null}
            </View>
            <Icon name="arrow-forward-outline" size={17} className="text-muted-foreground" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
