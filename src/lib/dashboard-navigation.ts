import type { ComponentProps } from 'react';
import type Icon from '@/components/Icon';
import type { ManagementSection } from '@/services/managementApi';

export type ManagementRole = 'landlord' | 'tenant';

export type ManagementDestination =
  | ManagementSection
  | 'landlord-analytics'
  | 'landlord-membership';

type ManagementNavItem = {
  id: ManagementDestination | 'dashboard';
  title: string;
  icon: ComponentProps<typeof Icon>['name'];
};

export const MANAGEMENT_TITLES: Record<ManagementDestination, string> = {
  'landlord-analytics': 'Phân tích & Báo cáo',
  'landlord-properties': 'Tin đăng',
  'landlord-membership': 'Gói hội viên & Lượt đăng',
  'landlord-branches': 'Chi nhánh / Tòa nhà',
  'landlord-appointments': 'Lịch xem nhà',
  'landlord-requests': 'Yêu cầu thuê',
  'landlord-contracts': 'Hợp đồng cho thuê',
  'landlord-payments': 'Lịch sử thanh toán',
  'tenant-appointments': 'Lịch đi xem',
  'tenant-requests': 'Yêu cầu đã gửi',
  'tenant-contracts': 'Hợp đồng đi thuê',
  'tenant-payments': 'Lịch sử thanh toán',
};

const dashboard: ManagementNavItem = {
  id: 'dashboard',
  title: 'Dashboard',
  icon: 'speedometer-outline',
};

function navItem(id: ManagementDestination, icon: ManagementNavItem['icon']): ManagementNavItem {
  return { id, title: MANAGEMENT_TITLES[id], icon };
}

export const MANAGEMENT_NAVIGATION: Record<
  ManagementRole,
  { title: string; items: ManagementNavItem[] }[]
> = {
  landlord: [
    {
      title: 'BẢNG ĐIỀU KHIỂN',
      items: [dashboard, navItem('landlord-analytics', 'stats-chart-outline')],
    },
    {
      title: 'QUẢN LÝ',
      items: [
        navItem('landlord-properties', 'document-text-outline'),
        navItem('landlord-membership', 'ribbon-outline'),
        navItem('landlord-branches', 'business-outline'),
        navItem('landlord-appointments', 'calendar-outline'),
        navItem('landlord-requests', 'paper-plane-outline'),
        navItem('landlord-contracts', 'document-attach-outline'),
        navItem('landlord-payments', 'time-outline'),
      ],
    },
  ],
  tenant: [
    { title: 'BẢNG ĐIỀU KHIỂN', items: [dashboard] },
    {
      title: 'THUÊ NHÀ',
      items: [
        navItem('tenant-appointments', 'calendar-outline'),
        navItem('tenant-requests', 'paper-plane-outline'),
        navItem('tenant-contracts', 'document-attach-outline'),
        navItem('tenant-payments', 'time-outline'),
      ],
    },
  ],
};
