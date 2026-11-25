import { useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import Icon from '@/components/Icon';

export type GalleryItem = { type: 'image' | 'video'; url: string };

// Port of web components/common/MediaGallery.tsx: paged items (videos last) and an "n / total"
// counter. Videos open in the system player because the app ships no video component.
export default function MediaGallery({ items }: { items: GalleryItem[] }) {
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const height = Math.round((width * 10) / 16);

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setCurrent(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View accessibilityLabel="Thư viện hình ảnh" className="bg-inverse">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}>
        {items.map((item, index) =>
          item.type === 'video' ? (
            <Pressable
              key={`${item.url}-${index}`}
              onPress={() => void Linking.openURL(item.url)}
              accessibilityRole="button"
              accessibilityLabel={`Phát video ${index + 1}`}
              style={{ width, height }}
              className="items-center justify-center bg-inverse">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-surface/95">
                <Icon name="play" size={30} className="text-foreground" />
              </View>
            </Pressable>
          ) : (
            <Image
              key={`${item.url}-${index}`}
              source={{ uri: item.url }}
              accessibilityLabel={`Ảnh ${index + 1}`}
              resizeMode="contain"
              style={{ width, height }}
              className="bg-inverse"
            />
          )
        )}
      </ScrollView>
      <View className="absolute bottom-3 left-3 rounded-full bg-inverse/70 px-3 py-1">
        <Text className="text-xs font-semibold text-on-inverse">
          {current + 1} / {items.length}
        </Text>
      </View>
    </View>
  );
}
