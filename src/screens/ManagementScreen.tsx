import { useState, type ComponentProps } from 'react';
import Ionicons from '@/components/Icon';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';

type IconName = ComponentProps<typeof Ionicons>['name'];
type ManagementRole = 'tenant' | 'landlord';

type ManagementItem = {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  count: number;
  rows: ManagementRow[];
};

type ManagementRow = {
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  tone: 'blue' | 'amber' | 'emerald' | 'slate';
};

const TENANT_ITEMS: ManagementItem[] = [
  {
    id: 'tenant-appointments',
    title: 'Lịch đi xem',
    description: 'Theo dõi lịch hẹn và đề xuất đổi giờ',
    icon: 'calendar-outline',
    count: 2,
    rows: [
      {
        title: 'Căn hộ 2 phòng ngủ gần trung tâm',
        subtitle: 'Thứ Hai · 09:00–10:00',
        meta: 'Quận Bình Thạnh, TP. Hồ Chí Minh',
        status: 'Đã xác nhận',
        tone: 'emerald',
      },
      {
        title: 'Phòng trọ đầy đủ nội thất',
        subtitle: 'Thứ Tư · 14:00–15:00',
        meta: 'TP. Thủ Đức, TP. Hồ Chí Minh',
        status: 'Chờ xác nhận',
        tone: 'amber',
      },
    ],
  },
  {
    id: 'tenant-requests',
    title: 'Yêu cầu đã gửi',
    description: 'Theo dõi yêu cầu thuê và tiến độ xử lý',
    icon: 'paper-plane-outline',
    count: 2,
    rows: [
      {
        title: 'Căn hộ studio có ban công',
        subtitle: 'Ngày vào ở dự kiến: 01/11/2026',
        meta: 'Đã gửi yêu cầu thuê',
        status: 'Chờ phản hồi',
        tone: 'amber',
      },
      {
        title: 'Phòng riêng gần Đại học Quốc gia',
        subtitle: 'Ngày vào ở dự kiến: 05/11/2026',
        meta: 'Chủ nhà đã chấp thuận',
        status: 'Đã chấp nhận',
        tone: 'emerald',
      },
    ],
  },
  {
    id: 'tenant-payments',
    title: 'Thanh toán',
    description: 'Kiểm tra khoản giữ chỗ cần thanh toán',
    icon: 'card-outline',
    count: 1,
    rows: [
      {
        title: 'Thanh toán giữ chỗ',
        subtitle: 'Phòng riêng gần Đại học Quốc gia',
        meta: '3.000.000 đ · Hạn thanh toán còn 23 giờ',
        status: 'Cần thanh toán',
        tone: 'blue',
      },
    ],
  },
];

const LANDLORD_ITEMS: ManagementItem[] = [
  {
    id: 'landlord-properties',
    title: 'Tin đăng',
    description: 'Quản lý nhà và trạng thái tin cho thuê',
    icon: 'home-outline',
    count: 2,
    rows: [
      {
        title: 'Căn hộ 2 phòng ngủ gần trung tâm',
        subtitle: '12.000.000 đ/tháng',
        meta: '124 lượt xem · 3 khách quan tâm',
        status: 'Đang hiển thị',
        tone: 'emerald',
      },
      {
        title: 'Phòng studio đầy đủ nội thất',
        subtitle: '5.500.000 đ/tháng',
        meta: 'Cập nhật lần cuối hôm nay',
        status: 'Chờ duyệt',
        tone: 'amber',
      },
    ],
  },
  {
    id: 'landlord-branches',
    title: 'Chi nhánh / Tòa nhà',
    description: 'Quản lý các địa điểm và phòng trực thuộc',
    icon: 'business-outline',
    count: 2,
    rows: [
      {
        title: 'HomeSpace Nguyễn Gia Trí',
        subtitle: '12 phòng · 3 phòng đang trống',
        meta: 'Quận Bình Thạnh, TP. Hồ Chí Minh',
        status: 'Đang hoạt động',
        tone: 'emerald',
      },
      {
        title: 'HomeSpace Võ Văn Ngân',
        subtitle: '8 phòng · 1 phòng đang trống',
        meta: 'TP. Thủ Đức, TP. Hồ Chí Minh',
        status: 'Đang hoạt động',
        tone: 'emerald',
      },
    ],
  },
  {
    id: 'landlord-appointments',
    title: 'Lịch xem nhà',
    description: 'Duyệt và quản lý lịch hẹn của khách',
    icon: 'calendar-outline',
    count: 3,
    rows: [
      {
        title: 'Nguyễn Minh Anh',
        subtitle: 'Căn hộ 2 phòng ngủ · Thứ Hai, 09:00',
        meta: 'Khách muốn xem trực tiếp',
        status: 'Chờ xác nhận',
        tone: 'amber',
      },
      {
        title: 'Trần Hoàng Nam',
        subtitle: 'Phòng studio · Thứ Ba, 15:30',
        meta: 'Đã xác nhận lịch với khách',
        status: 'Đã xác nhận',
        tone: 'emerald',
      },
    ],
  },
  {
    id: 'landlord-requests',
    title: 'Yêu cầu thuê',
    description: 'Xem và phản hồi yêu cầu từ khách thuê',
    icon: 'mail-unread-outline',
    count: 2,
    rows: [
      {
        title: 'Lê Khánh Linh',
        subtitle: 'Muốn thuê căn hộ studio từ 01/11/2026',
        meta: '2 người ở · 1 xe máy',
        status: 'Mới',
        tone: 'blue',
      },
      {
        title: 'Phạm Quốc Bảo',
        subtitle: 'Muốn thuê phòng riêng từ 05/11/2026',
        meta: '1 người ở · Không có phương tiện',
        status: 'Đang xem xét',
        tone: 'amber',
      },
    ],
  },
  {
    id: 'landlord-payments',
    title: 'Thanh toán',
    description: 'Kiểm tra giao dịch giữ chỗ từ khách',
    icon: 'wallet-outline',
    count: 1,
    rows: [
      {
        title: 'Khoản giữ chỗ từ Lê Khánh Linh',
        subtitle: 'Căn hộ studio có ban công',
        meta: '3.000.000 đ · Khách đã báo chuyển',
        status: 'Cần xác nhận',
        tone: 'blue',
      },
    ],
  },
];

const TONE_CLASSES = {
  blue: 'bg-primary-soft text-primary',
  amber: 'bg-warning-soft text-warning',
  emerald: 'bg-success-soft text-success',
  slate: 'bg-muted text-secondary',
};

function RoleButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${active ? 'bg-surface shadow-sm' : ''}`}>
      <Ionicons
        name={icon}
        size={18}
        className={active ? 'text-primary' : 'text-muted-foreground'}
      />
      <Text
        className={`ml-2 text-sm font-bold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function DetailView({ item, onBack }: { item: ManagementItem; onBack: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-border bg-surface px-4 py-3">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Quay lại quản lý"
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Ionicons name="chevron-back" size={24} className="text-foreground" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-extrabold text-foreground">{item.title}</Text>
          <Text className="text-xs text-muted-foreground">{item.description}</Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10 pt-5">
        <View className="mb-4 flex-row items-center rounded-2xl bg-primary-soft px-4 py-3">
          <Ionicons name="color-wand-outline" size={18} className="text-primary" />
          <Text className="ml-2 flex-1 text-xs font-semibold text-primary">
            Dữ liệu giao diện mẫu · API sẽ được nối ở bước tiếp theo
          </Text>
        </View>

        {item.rows.map((row) => (
          <Pressable
            key={`${item.id}-${row.title}`}
            className="mb-3 rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <View className="flex-row items-start">
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft">
                <Ionicons name={item.icon} size={21} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-extrabold text-foreground">{row.title}</Text>
                <Text className="mt-1 text-xs font-semibold text-secondary">{row.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} className="text-subtle" />
            </View>
            <View className="mt-4 flex-row items-center justify-between border-t border-border pt-3">
              <Text className="mr-3 flex-1 text-xs text-muted-foreground">{row.meta}</Text>
              <View className={`rounded-full px-3 py-1.5 ${TONE_CLASSES[row.tone]}`}>
                <Text className={`text-[11px] font-bold ${TONE_CLASSES[row.tone].split(' ')[1]}`}>
                  {row.status}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ManagementScreen({ onSelectTab }: { onSelectTab: (tab: MainTab) => void }) {
  const [role, setRole] = useState<ManagementRole>('tenant');
  const [selectedItem, setSelectedItem] = useState<ManagementItem | null>(null);
  const items = role === 'tenant' ? TENANT_ITEMS : LANDLORD_ITEMS;

  if (selectedItem) {
    return <DetailView item={selectedItem} onBack={() => setSelectedItem(null)} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <View className="bg-brand px-5 pb-7 pt-3">
          <Text className="text-xs font-semibold uppercase tracking-widest text-on-brand-muted">
            HomeSpace
          </Text>
          <Text className="mt-1 text-2xl font-extrabold text-on-brand">Quản lý</Text>
          <Text className="mt-2 text-sm leading-5 text-on-brand-muted">
            Theo dõi hành trình thuê nhà ở cả hai vai trò.
          </Text>
        </View>

        <View className="-mt-4 px-5">
          <View className="flex-row rounded-2xl border border-border bg-muted p-1.5 shadow-sm">
            <RoleButton
              active={role === 'tenant'}
              icon="key-outline"
              label="Người thuê"
              onPress={() => setRole('tenant')}
            />
            <RoleButton
              active={role === 'landlord'}
              icon="business-outline"
              label="Cho thuê"
              onPress={() => setRole('landlord')}
            />
          </View>

          <View className="mt-6 flex-row items-end justify-between">
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-foreground">
                {role === 'tenant' ? 'Quản lý đi thuê' : 'Quản lý cho thuê'}
              </Text>
              <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                {role === 'tenant'
                  ? 'Lịch xem, yêu cầu thuê và khoản cần thanh toán.'
                  : 'Nhà cho thuê, lịch hẹn và yêu cầu từ khách.'}
              </Text>
            </View>
            <View className="rounded-full bg-primary-soft px-3 py-1.5">
              <Text className="text-xs font-bold text-primary">{items.length} mục</Text>
            </View>
          </View>

          <View className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            {items.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedItem(item)}
                accessibilityRole="button"
                accessibilityLabel={`Mở ${item.title}`}
                className={`flex-row items-center px-4 py-4 ${index < items.length - 1 ? 'border-b border-border' : ''}`}>
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
                  <Ionicons name={item.icon} size={23} className="text-primary" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-extrabold text-foreground">{item.title}</Text>
                  <Text className="mt-1 text-xs leading-4 text-muted-foreground">
                    {item.description}
                  </Text>
                </View>
                {item.count > 0 ? (
                  <View className="mr-2 min-w-7 items-center rounded-full bg-danger-soft px-2 py-1">
                    <Text className="text-xs font-extrabold text-danger">{item.count}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={19} className="text-subtle" />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomTabBar active="management" onSelect={onSelectTab} />
    </SafeAreaView>
  );
}
