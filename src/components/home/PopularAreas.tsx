import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { getCityListingCounts } from '@/services/listingApi';

// cityId values match src/data/provinces.json (11 Hà Nội, 12 TP.HCM, 13 Đà Nẵng, 14 Hải Phòng, 15 Cần Thơ).
const MAIN_AREA = {
  cityId: '12',
  name: 'Tp Hồ Chí Minh',
  image: require('../../../assets/area/hcm-1.jpg'),
};
const SUB_AREAS = [
  { cityId: '11', name: 'Hà Nội', image: require('../../../assets/area/ha-noi-1.jpg') },
  { cityId: '13', name: 'Đà Nẵng', image: require('../../../assets/area/da-nang-1.jpg') },
  { cityId: '15', name: 'Cần Thơ', image: require('../../../assets/area/can-tho-1.jpg') },
  { cityId: '14', name: 'Hải Phòng', image: require('../../../assets/area/hai-phong-1.jpg') },
];
const CATEGORIES = [
  { label: 'Nhà nguyên căn', value: 'HOUSE' },
  { label: 'Căn hộ chung cư', value: 'APARTMENT' },
  { label: 'Phòng trọ', value: 'ROOM' },
];

type Area = typeof MAIN_AREA;

export default function PopularAreas({
  onSelect,
}: {
  onSelect: (cityId: string, category: string) => void;
}) {
  const [category, setCategory] = useState('APARTMENT');
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Explicit pixel sizes: aspectRatio + absolute-fill classes rendered a blank grid on device.
  const { width } = useWindowDimensions();
  const GAP = 12;
  const full = width - 40;
  const half = (full - GAP) / 2;

  useEffect(() => {
    let cancelled = false;
    getCityListingCounts(category)
      .then((rows) => {
        if (cancelled) return;
        setCounts(Object.fromEntries(rows.map((row) => [row.cityId, Number(row.count) || 0])));
      })
      .catch(() => {
        if (!cancelled) setCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const tile = (area: Area, large: boolean) => {
    const w = large ? full : half;
    const h = large ? full * (9 / 16) : half * 0.8;
    return (
      <Pressable
        key={area.cityId}
        onPress={() => onSelect(area.cityId, category)}
        accessibilityRole="button"
        accessibilityLabel={`${area.name}, ${(counts[area.cityId] ?? 0).toLocaleString('vi-VN')} tin đăng`}
        className="overflow-hidden rounded-2xl bg-muted"
        style={{ width: w, height: h }}>
        <Image source={area.image} resizeMode="cover" style={{ width: w, height: h }} />
        <View className="absolute bottom-0 left-0 right-0 bg-overlay/60 p-3">
          <Text className={`font-bold text-on-brand ${large ? 'text-xl' : 'text-base'}`}>
            {area.name}
          </Text>
          <Text className="text-sm font-medium text-on-brand-muted">
            {(counts[area.cityId] ?? 0).toLocaleString('vi-VN')} tin đăng
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="mt-8 px-5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-primary">
        Khu vực nổi bật
      </Text>
      <Text className="mt-1 text-xl font-bold text-foreground">Nhà cho thuê theo khu vực</Text>
      <Text className="mt-1 text-sm leading-5 text-muted-foreground">
        Khám phá không gian sống lý tưởng tại các trung tâm đô thị sôi động nhất cả nước.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 mt-4"
        contentContainerStyle={{ paddingHorizontal: 20 }}>
        {CATEGORIES.map((item) => {
          const active = category === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setCategory(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`mr-2 min-h-10 justify-center rounded-full px-4 ${active ? 'bg-inverse' : 'border border-border bg-surface'}`}>
              <Text
                className={`text-sm font-semibold ${active ? 'text-on-inverse' : 'text-secondary'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View className="mt-4 flex-row flex-wrap" style={{ gap: GAP }}>
        {tile(MAIN_AREA, true)}
        {SUB_AREAS.map((area) => tile(area, false))}
      </View>
    </View>
  );
}
