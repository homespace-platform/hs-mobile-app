import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const CATEGORIES = [
  { label: 'Nhà nguyên căn', value: 'HOUSE' },
  { label: 'Căn hộ chung cư', value: 'APARTMENT' },
  { label: 'Phòng trọ', value: 'ROOM' },
];

function AreaMap({ cityName }: { cityName: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // Embedding the map inside an iframe with a google.com baseUrl gives it a normal page origin;
  // loading the embed URL as the WebView's top-level page rendered a blank frame on Android.
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(`${cityName}, Vietnam`)}&z=12&output=embed`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${mapUrl}" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></body></html>`;

  return (
    <View
      className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface"
      style={{ height: 220 }}>
      {state === 'error' ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm font-semibold text-foreground">Không tải được bản đồ</Text>
          <Pressable
            onPress={() => {
              setState('loading');
              setAttempt((value) => value + 1);
            }}
            accessibilityRole="button"
            className="mt-3 min-h-11 justify-center rounded-xl bg-brand px-5">
            <Text className="text-sm font-bold text-on-brand">Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <WebView
            key={attempt}
            source={{ html, baseUrl: 'https://www.google.com' }}
            originWhitelist={['https://*', 'about:*']}
            javaScriptEnabled
            domStorageEnabled
            nestedScrollEnabled
            scrollEnabled={false}
            onLoadEnd={() => setState((current) => (current === 'error' ? current : 'ready'))}
            onError={() => setState('error')}
            onHttpError={() => setState('error')}
            style={{ flex: 1 }}
            accessibilityLabel={`Bản đồ khu vực ${cityName}`}
          />
          {state === 'loading' ? (
            <View className="absolute inset-0 items-center justify-center bg-surface">
              <ActivityIndicator className="text-primary" />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export default function PriceExplorer({
  cityCode,
  cityName,
  onViewPrice,
}: {
  cityCode: string;
  cityName: string;
  onViewPrice: (category: string) => void;
}) {
  const [category, setCategory] = useState('APARTMENT');

  return (
    <View className="mt-8 px-5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-primary">
        Giá thị trường
      </Text>
      <Text className="mt-1 text-xl font-bold text-foreground">Tham khảo giá thuê nhà</Text>
      <Text className="mt-1 text-sm leading-5 text-muted-foreground">
        Dùng khu vực đã chọn ở trên để xem giá thuê trên HomeSpace
      </Text>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {CATEGORIES.map((item) => {
          const active = category === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setCategory(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`min-h-11 justify-center rounded-full px-4 ${active ? 'bg-brand' : 'border border-border bg-surface'}`}>
              <Text
                className={`text-sm font-semibold ${active ? 'text-on-brand' : 'text-secondary'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => onViewPrice(category)}
        accessibilityRole="button"
        className="mt-4 min-h-12 items-center justify-center rounded-xl bg-brand">
        <Text className="font-bold text-on-brand">Xem giá ngay</Text>
      </Pressable>
      <AreaMap key={cityCode} cityName={cityName} />
    </View>
  );
}
