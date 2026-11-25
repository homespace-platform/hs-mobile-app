import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import {
  formatLocationLabel,
  formatPrice,
  type RentMetric,
  type RentProperty,
} from '@/lib/rent-detail';
import type { IconName } from './DetailSectionCard';

const METRIC_ICONS: Record<RentMetric['icon'], IconName> = {
  area: 'resize-outline',
  bed: 'bed-outline',
  building: 'business-outline',
  users: 'people-outline',
  bath: 'water-outline',
};

function LocationChip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-border bg-surface px-2.5 py-1">
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
    </View>
  );
}

// Web RentDetailView overview section: badges, title, address, price, quick metrics, highlights.
export default function OverviewCard({
  property,
  metrics,
  highlights,
  isNegotiable,
  children,
}: {
  property: RentProperty;
  metrics: RentMetric[];
  highlights: string[];
  isNegotiable: boolean;
  children?: ReactNode;
}) {
  const provinceLabel = formatLocationLabel(property.provinceName || property.city);
  const wardLabel = formatLocationLabel(property.ward || property.district);
  return (
    <View className="rounded-2xl border border-border bg-surface p-4">
      <View className="mb-3 flex-row flex-wrap items-center gap-2">
        <Text className="overflow-hidden rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
          {property.categoryLabel}
        </Text>
        {property.isVerified ? (
          <View className="flex-row items-center gap-1 rounded-full bg-success-soft px-2.5 py-1">
            <Icon name="shield-checkmark-outline" size={14} className="text-success" />
            <Text className="text-xs font-semibold text-success">Đã xác minh</Text>
          </View>
        ) : null}
        {property.hasVideo ? (
          <View className="flex-row items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1">
            <Icon name="videocam-outline" size={14} className="text-primary" />
            <Text className="text-xs font-semibold text-primary">Có video tham quan</Text>
          </View>
        ) : null}
      </View>

      <Text accessibilityRole="header" className="text-xl font-bold leading-7 text-foreground">
        {property.title}
      </Text>

      <View className="mt-2 flex-row items-start gap-2">
        <Icon name="location-outline" size={17} className="mt-0.5 text-primary" />
        <Text className="flex-1 text-sm leading-5 text-muted-foreground">{property.location}</Text>
      </View>
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        {wardLabel ? <LocationChip label={wardLabel} /> : null}
        {property.provinceCode && provinceLabel ? <LocationChip label={provinceLabel} /> : null}
      </View>

      <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Icon name="time-outline" size={14} className="text-muted-foreground" />
        <Text className="text-xs text-muted-foreground">{property.timeAgo}</Text>
        <Text className="text-xs text-muted-foreground">·</Text>
        <Icon name="eye-outline" size={14} className="text-muted-foreground" />
        <Text className="text-xs text-muted-foreground">{property.viewCount} lượt xem</Text>
      </View>

      <View className="mt-5 flex-row flex-wrap items-baseline gap-x-2 gap-y-2">
        <Text className="text-3xl font-bold text-primary">
          {formatPrice(property.priceMillion)}
        </Text>
        <Text className="text-sm text-muted-foreground">/tháng</Text>
        {isNegotiable ? (
          <Text className="ml-1 overflow-hidden rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
            Có thể thương lượng
          </Text>
        ) : null}
      </View>

      <View className="mt-5 flex-row gap-2">
        {metrics.map((metric) => (
          <View
            key={metric.label}
            className="min-w-0 flex-1 items-center gap-1 rounded-xl bg-muted px-2 py-3">
            <Icon name={METRIC_ICONS[metric.icon]} size={20} className="text-primary" />
            <Text className="text-center text-sm font-semibold text-foreground">
              {metric.value}
            </Text>
            <Text className="text-center text-xs text-muted-foreground">{metric.label}</Text>
          </View>
        ))}
      </View>

      {highlights.length > 0 ? (
        <View className="mt-5 flex-row flex-wrap gap-2">
          {highlights.map((highlight) => (
            <View
              key={highlight}
              className="flex-row items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5">
              <Icon name="camera-outline" size={14} className="text-primary" />
              <Text className="text-xs font-medium text-foreground">{highlight}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
}
