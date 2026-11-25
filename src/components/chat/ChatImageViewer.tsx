import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import type { ChatAttachment } from '@/services/chatApi';
import { getChatAttachmentViewUrl } from '@/services/chatMediaApi';

function useChatImage(conversationId: string, storageId: string) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    getChatAttachmentViewUrl(conversationId, storageId).then(
      (uri) => {
        if (mounted) setUrl(uri);
      },
      () => {
        if (mounted) setFailed(true);
      }
    );
    return () => {
      mounted = false;
    };
  }, [attempt, conversationId, storageId]);

  return {
    url,
    failed,
    fail: () => setFailed(true),
    retry() {
      setUrl(undefined);
      setFailed(false);
      setAttempt((current) => current + 1);
    },
  };
}

export function ChatImageThumbnail({
  conversationId,
  image,
  onPress,
  className,
}: {
  conversationId: string;
  image: ChatAttachment;
  onPress: () => void;
  className: string;
}) {
  const { url, failed, fail } = useChatImage(conversationId, image.storageId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mở ảnh ${image.fileName}`}
      onPress={onPress}
      className={`items-center justify-center overflow-hidden rounded-xl bg-muted active:opacity-80 ${className}`}>
      {failed ? (
        <Icon name="image-outline" size={24} className="text-muted-foreground" />
      ) : url ? (
        <Image source={{ uri: url }} onError={fail} className="h-full w-full" />
      ) : (
        <ActivityIndicator className="text-primary" />
      )}
    </Pressable>
  );
}

function ViewerButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'close' | 'chevron-back' | 'chevron-forward' | 'add' | 'remove';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-full bg-muted active:opacity-70 disabled:opacity-40">
      <Icon name={icon} size={24} className="text-foreground" />
    </Pressable>
  );
}

function ViewerImage({
  conversationId,
  image,
  zoom,
}: {
  conversationId: string;
  image: ChatAttachment;
  zoom: number;
}) {
  const { url, failed, fail, retry } = useChatImage(conversationId, image.storageId);
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      onLayout={({ nativeEvent: { layout } }) =>
        setSize({ width: layout.width, height: layout.height })
      }
      className="flex-1 items-center justify-center">
      {failed ? (
        <Pressable accessibilityRole="button" onPress={retry} className="p-4">
          <Text className="text-center text-primary">Không tải được ảnh · Thử lại</Text>
        </Pressable>
      ) : url && size.width > 0 && size.height > 0 ? (
        <ScrollView key={zoom} nestedScrollEnabled scrollEnabled={zoom > 1} style={size}>
          <ScrollView horizontal nestedScrollEnabled scrollEnabled={zoom > 1}>
            <Image
              source={{ uri: url }}
              accessibilityLabel={image.fileName}
              accessible
              onError={fail}
              resizeMode="contain"
              style={{ width: size.width * zoom, height: size.height * zoom }}
            />
          </ScrollView>
        </ScrollView>
      ) : (
        <ActivityIndicator className="text-primary" />
      )}
    </View>
  );
}

export default function ChatImageViewer({
  conversationId,
  images,
  initialIndex,
  onClose,
}: {
  conversationId: string;
  images: ChatAttachment[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const image = images[index];

  const navigate = useCallback(
    (offset: number) => {
      setIndex((current) => Math.max(0, Math.min(images.length - 1, current + offset)));
      setZoom(1);
    },
    [images.length]
  );
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, { dx, dy, numberActiveTouches }) =>
          zoom === 1 &&
          images.length > 1 &&
          numberActiveTouches === 1 &&
          Math.abs(dx) > 18 &&
          Math.abs(dx) > Math.abs(dy) * 1.5,
        onPanResponderRelease: (_, { dx }) => {
          if (Math.abs(dx) > 42) navigate(dx < 0 ? 1 : -1);
        },
      }),
    [images.length, navigate, zoom]
  );

  if (!image) return null;
  return (
    <Modal animationType="fade" onRequestClose={onClose}>
      <SafeAreaView accessibilityViewIsModal className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 px-4 py-2">
          <ViewerButton icon="close" label="Đóng trình xem ảnh" onPress={onClose} />
          <Text numberOfLines={1} className="flex-1 font-semibold text-foreground">
            {image.fileName}
          </Text>
          <Text accessibilityLiveRegion="polite" className="text-muted-foreground">
            {index + 1} / {images.length}
          </Text>
        </View>
        <View className="flex-1" {...swipe.panHandlers}>
          <ViewerImage key={index} conversationId={conversationId} image={image} zoom={zoom} />
        </View>
        <View className="flex-row justify-center gap-3 px-4 py-2">
          <ViewerButton
            icon="chevron-back"
            label="Ảnh trước"
            disabled={index === 0}
            onPress={() => navigate(-1)}
          />
          <ViewerButton
            icon="remove"
            label="Thu nhỏ ảnh"
            disabled={zoom === 1}
            onPress={() => setZoom((current) => Math.max(1, current - 0.5))}
          />
          <ViewerButton
            icon="add"
            label="Phóng to ảnh"
            disabled={zoom === 3}
            onPress={() => setZoom((current) => Math.min(3, current + 0.5))}
          />
          <ViewerButton
            icon="chevron-forward"
            label="Ảnh tiếp theo"
            disabled={index === images.length - 1}
            onPress={() => navigate(1)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
