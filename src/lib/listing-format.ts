export const LISTING_CATEGORIES: { label: string; value?: string }[] = [
  { label: 'Tất cả' },
  { label: 'Nhà nguyên căn', value: 'HOUSE' },
  { label: 'Căn hộ chung cư', value: 'APARTMENT' },
  { label: 'Phòng trọ', value: 'ROOM' },
];

export function categoryLabel(category: string) {
  return (
    LISTING_CATEGORIES.find((item) => item.value === category)?.label ??
    (category === 'OFFICE' ? 'Văn phòng' : undefined) ??
    (category || 'Nhà cho thuê').replace(/_/g, ' ')
  );
}

const PRICE_UNIT_LABELS: Record<string, string> = {
  MONTH: 'tháng',
  ROOM_MONTH: 'phòng/tháng',
  PERSON_MONTH: 'người/tháng',
  M2_MONTH: 'm²/tháng',
  SEAT_MONTH: 'chỗ/tháng',
};

export function formatListingPrice(value: number, unit?: string) {
  if (!value) return 'Thỏa thuận';
  const label = PRICE_UNIT_LABELS[unit ?? ''] ?? 'tháng';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu/${label}`;
  }
  return `${value.toLocaleString('vi-VN')} đ/${label}`;
}

// Same buckets as the web `formatTimeAgo`.
export function formatTimeAgo(iso?: string | null, nowMs = Date.now()) {
  const then = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(then) || nowMs - then < 60_000) return 'Vừa xong';
  const minutes = Math.floor((nowMs - then) / 60_000);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  if (days < 28) return `${Math.floor(days / 7)} tuần trước`;
  if (days < 360) return `${Math.floor(days / 30)} tháng trước`;
  return new Date(then).toLocaleDateString('vi-VN');
}
