import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import {
  currentLocationDirectionsUrl,
  isNearbySyncPending,
  NEARBY_GROUPS,
  NEARBY_PAGE_SIZE,
  NEARBY_RADIUS_METERS,
  nearbyDirectionsUrl,
  validCoordinates,
  watchNearbySync,
  type NearbyGroup,
  type NearbyPage,
} from '@/lib/nearby';
import { getNearbyPlaces } from '@/services/nearbyApi';
import { Notice } from './DetailSectionCard';

type Result = { key: string; data: NearbyPage | null; error: string; watching?: boolean };

function TextAction({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: 'refresh' | 'open-outline';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-11 flex-row items-center justify-center gap-1 px-1 ${disabled ? 'opacity-40' : ''}`}>
      {icon === 'refresh' ? <Icon name="refresh" size={14} className="text-primary" /> : null}
      <Text className="text-xs font-semibold text-primary">{label}</Text>
      {icon === 'open-outline' ? (
        <Icon name="open-outline" size={12} className="text-primary" />
      ) : null}
    </Pressable>
  );
}

// Port of web components/nearby/NearbyPlacesPanel.tsx. The native map tab is skipped (the app has
// no VietMap SDK): only the list and the "Chỉ đường đến bài đăng" shortcut are shown.
export default function NearbyPlaces({
  listingId,
  latitude,
  longitude,
}: {
  listingId: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const radius = NEARBY_RADIUS_METERS;
  const [group, setGroup] = useState<NearbyGroup | ''>('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>({ key: '', data: null, error: '' });
  const origin = { latitude, longitude };
  const listingDirectionsUrl = currentLocationDirectionsUrl(origin);
  const hasListingCoordinates = validCoordinates(origin);
  const requestKey = JSON.stringify([listingId, latitude, longitude, radius, group, page, attempt]);
  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? '' : result.error;

  useEffect(() => {
    const controller = new AbortController();
    watchNearbySync(
      () => getNearbyPlaces(listingId, group, page, controller.signal),
      (next, watching) => setResult({ key: requestKey, data: next, error: '', watching }),
      () =>
        setResult({
          key: requestKey,
          data: null,
          error: 'Chưa tải được tiện ích xung quanh. Bạn có thể thử lại.',
        }),
      controller.signal
    );
    return () => controller.abort();
  }, [listingId, group, page, requestKey]);

  if (data?.enabled === false) return null;
  const coverage = data?.coverage.groups ?? [];
  const complete =
    coverage.length > 0 &&
    coverage.every(
      (g) =>
        g.coverageStatus === 'COMPLETE_PROVIDER_RESPONSE' && (g.radiusCoveredMeters ?? 0) >= radius
    );
  const limited = coverage.some((g) => g.coverageStatus === 'LIMITED_PROVIDER_RESPONSE');
  const lastChecked = coverage.flatMap((g) => (g.dataAsOf ? [g.dataAsOf] : [])).sort()[0];
  const syncing = isNearbySyncPending(data?.syncStatus);
  const totalPages = data ? Math.ceil(data.total / data.size) : 0;

  function selectGroup(next: NearbyGroup | '') {
    setGroup(next);
    setPage(1);
  }

  return (
    <View className="gap-4 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
          Tiện ích xung quanh
        </Text>
        <Text className="overflow-hidden rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          Trong 2 km
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2">
        {(
          [
            ['', 'Tất cả'],
            ...Object.entries(NEARBY_GROUPS).filter(([code]) => code !== 'SPORTS'),
          ] as [NearbyGroup | '', string][]
        ).map(([code, label]) => {
          const active = group === code;
          return (
            <Pressable
              key={code || 'ALL'}
              onPress={() => selectGroup(code)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`min-h-9 justify-center rounded-full border px-3 py-1.5 ${active ? 'border-primary bg-primary-soft' : 'border-border'}`}>
              <Text className={`text-xs ${active ? 'text-primary' : 'text-foreground'}`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text className="text-xs leading-5 text-muted-foreground">
        Khám phá các địa điểm trong phạm vi 2 km quanh bài đăng.
        {lastChecked ? ` Cập nhật: ${new Date(lastChecked).toLocaleString('vi-VN')}.` : ''}
      </Text>
      <Text className="text-xs text-muted-foreground">
        {hasListingCoordinates
          ? 'Chỉ đường từ vị trí bài đăng đến tiện ích.'
          : 'Tin đăng chưa có tọa độ hợp lệ để chỉ đường.'}
      </Text>

      {listingDirectionsUrl ? (
        <Pressable
          onPress={() => void Linking.openURL(listingDirectionsUrl)}
          accessibilityRole="link"
          accessibilityLabel="Chỉ đường từ vị trí hiện tại đến bài đăng"
          className="min-h-11 flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5">
          <Icon name="navigate-outline" size={16} className="text-on-brand" />
          <Text className="text-sm font-semibold text-on-brand">Chỉ đường đến bài đăng</Text>
        </Pressable>
      ) : null}

      {!complete && data && !syncing ? (
        <Notice
          tone="warning"
          title="Dữ liệu địa điểm lân cận"
          text={
            limited
              ? 'Mỗi bài đăng hiển thị tối đa 100 địa điểm đã thu thập trong 2 km. Nhóm chưa có kết quả có thể chưa nằm trong danh sách này.'
              : 'Dữ liệu chưa phủ đủ phạm vi hoặc nhóm tiện ích đang chọn. Chỉ hiển thị các địa điểm đã có dữ liệu.'
          }
        />
      ) : null}
      {error ? (
        <View accessibilityRole="alert" className="flex-row items-center gap-3">
          <Text className="flex-1 text-sm text-foreground">{error}</Text>
          <TextAction label="Thử lại" icon="refresh" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      ) : null}
      {loading ? <Text className="text-sm text-muted-foreground">Đang tải tiện ích...</Text> : null}
      {syncing ? (
        <View className="flex-row flex-wrap items-center gap-3">
          <Text className="flex-1 text-sm text-muted-foreground">
            {result.watching
              ? 'Đang cập nhật tiện ích theo vị trí mới. Kết quả sẽ tự hiển thị khi sẵn sàng.'
              : 'Tiện ích theo vị trí mới chưa sẵn sàng. Bạn có thể kiểm tra lại sau ít phút.'}
          </Text>
          <TextAction
            label="Kiểm tra lại"
            icon="refresh"
            onPress={() => setAttempt((n) => n + 1)}
          />
        </View>
      ) : null}
      {data && data.items.length === 0 && !syncing ? (
        <Text className="text-sm text-muted-foreground">
          Chưa tìm thấy địa điểm phù hợp trong dữ liệu hiện tại.
        </Text>
      ) : null}

      {data && data.items.length > 0 ? (
        <View accessibilityLabel="Danh sách tiện ích">
          {data.items.map((place, index) => {
            const directionsUrl = nearbyDirectionsUrl(origin, place);
            return (
              <View
                key={place.id}
                className={`flex-row items-start gap-3 py-3 ${index ? 'border-t border-border' : ''}`}>
                <Icon name="location-outline" size={18} className="mt-1 text-primary" />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-foreground">{place.name}</Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">{place.address}</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {place.groups.map((g) => NEARBY_GROUPS[g]).join(' · ')}
                  </Text>
                </View>
                <TextAction
                  label="Chỉ đường"
                  icon="open-outline"
                  disabled={!directionsUrl}
                  onPress={() => directionsUrl && void Linking.openURL(directionsUrl)}
                />
              </View>
            );
          })}
        </View>
      ) : null}

      {data && data.total > data.size ? (
        <View className="flex-row items-center justify-between">
          <TextAction
            label="‹ Trước"
            disabled={page <= 1 || loading}
            onPress={() => setPage((n) => n - 1)}
          />
          <Text className="text-sm text-foreground">
            Trang {page} / {totalPages}
          </Text>
          <TextAction
            label="Tiếp ›"
            disabled={page * data.size >= data.total || loading}
            onPress={() => setPage((n) => n + 1)}
          />
        </View>
      ) : null}

      <Text className="text-[11px] leading-4 text-muted-foreground">
        Địa điểm: © TomTom · Bản đồ: VietMap. Bản đồ hiển thị tối đa {NEARBY_PAGE_SIZE} tiện ích
        trên trang hiện tại. Dữ liệu nguồn không xác nhận địa điểm đang hoạt động.
      </Text>
    </View>
  );
}
