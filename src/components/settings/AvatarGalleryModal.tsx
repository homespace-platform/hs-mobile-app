import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import { Button, ErrorNotice } from '@/components/Screen';

export type AvatarItem = { id: string; url: string };

// Counterpart of web MediaLightboxModal for avatars: browse past avatars and reuse one.
export default function AvatarGalleryModal({
  visible,
  title,
  items,
  currentId,
  initialIndex,
  fallbackUri,
  name,
  restoring,
  error,
  onClose,
  onUse,
}: {
  visible: boolean;
  title: string;
  items: AvatarItem[];
  currentId?: string | null;
  initialIndex: number;
  fallbackUri?: string | null;
  name: string;
  restoring: boolean;
  error: string | null;
  onClose: () => void;
  onUse: (id: string) => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);
  const selected = items[index];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-row items-center border-b border-border bg-surface px-4 py-3">
          <Text accessibilityRole="header" className="flex-1 text-lg font-bold text-foreground">
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            disabled={restoring}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            className="h-11 w-11 items-center justify-center">
            <Icon name="close" size={24} className="text-foreground" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          {selected ? (
            <Image
              source={{ uri: selected.url }}
              accessibilityLabel={title}
              resizeMode="contain"
              className="aspect-square w-full bg-muted"
            />
          ) : (
            <Avatar uri={fallbackUri} name={name} size={240} />
          )}
        </View>
        <View className="px-5 pb-4">
          <ErrorNotice message={error} />
          {selected && selected.id !== currentId ? (
            <Button
              label={restoring ? 'Đang cập nhật...' : 'Đặt làm ảnh đại diện'}
              onPress={() => onUse(selected.id)}
              busy={restoring}
            />
          ) : selected ? (
            <Text className="text-center text-sm text-muted-foreground">Ảnh đại diện hiện tại</Text>
          ) : null}
        </View>
        {items.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="grow-0"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
            {items.map((item, position) => (
              <Pressable
                key={item.id}
                disabled={restoring}
                onPress={() => setIndex(position)}
                accessibilityRole="button"
                accessibilityLabel={`Ảnh đại diện ${position + 1}`}
                accessibilityState={{ selected: position === index }}
                className={`overflow-hidden rounded-xl border-2 ${position === index ? 'border-primary' : 'border-border'}`}>
                <Image source={{ uri: item.url }} className="h-16 w-16 bg-muted" />
                {item.id === currentId ? (
                  <View className="absolute bottom-0 right-0 rounded-tl-lg bg-brand p-0.5">
                    <Icon name="checkmark" size={12} className="text-on-brand" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
