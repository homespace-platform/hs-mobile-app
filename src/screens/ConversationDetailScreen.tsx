import { useRef, useState } from 'react';
import Ionicons from '@/components/Icon';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { useDialog } from '@/components/AppDialog';
import {
  listMessages,
  updateParticipantRole,
  type ChatConversation,
  type ChatMessage,
} from '@/services/chatApi';
import { listingImage } from '@/services/listingApi';
import { getStorageViewUrl } from '@/services/storageApi';

const ROLE_OPTIONS = [
  { value: 'TENANT' as const, label: 'Người hỏi thuê', icon: 'person-outline' as const },
  { value: 'LANDLORD' as const, label: 'Chủ thuê', icon: 'home-outline' as const },
];

function roleLabel(role?: ChatConversation['participantRole']) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? 'Chưa gán nhãn';
}

export default function ConversationDetailScreen({
  conversation,
  onBack,
  onUpdated,
}: {
  conversation: ChatConversation;
  onBack: () => void;
  onUpdated: (conversation: ChatConversation) => void;
}) {
  const [role, setRole] = useState(conversation.participantRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState<'search' | 'images' | null>(null);
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [nextBefore, setNextBefore] = useState<string>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const requestId = useRef(0);
  const showDialog = useDialog();

  async function loadHistory(mode: 'search' | 'images', search?: string, before?: string) {
    const currentRequest = before ? requestId.current : ++requestId.current;
    setHistoryLoading(true);
    setHistoryError(null);
    if (!before) {
      setHistory([]);
      setNextBefore(undefined);
      setImageUrls({});
    }
    try {
      const page = await listMessages(conversation.id, {
        limit: 20,
        ...(before ? { before } : {}),
        ...(mode === 'images' ? { media: 'images' as const } : { search }),
      });
      if (currentRequest !== requestId.current) return;
      setHistory((current) => [...(before ? current : []), ...page.items.slice().reverse()]);
      setNextBefore(page.nextBefore);
      if (mode === 'images') {
        const images = page.items.flatMap((message) =>
          (message.attachments ?? []).filter((attachment) =>
            attachment.contentType.startsWith('image/')
          )
        );
        const urls = await Promise.allSettled(
          images.map((image) => getStorageViewUrl(image.storageId))
        );
        if (currentRequest === requestId.current) {
          setImageUrls((current) => ({
            ...current,
            ...Object.fromEntries(
              urls.flatMap((result, index) =>
                result.status === 'fulfilled' ? [[images[index].storageId, result.value]] : []
              )
            ),
          }));
        }
      }
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setHistoryError(loadError instanceof Error ? loadError.message : 'Không tải được lịch sử');
      }
    } finally {
      if (currentRequest === requestId.current) setHistoryLoading(false);
    }
  }

  function openHistory(mode: 'search' | 'images') {
    setHistoryMode(mode);
    setHistory([]);
    setNextBefore(undefined);
    setHistoryError(null);
    setSubmittedKeyword('');
    if (mode === 'search') setKeyword('');
    if (mode === 'images') void loadHistory(mode);
  }

  function submitSearch() {
    const query = keyword.trim();
    if (!query) return;
    setSubmittedKeyword(query);
    void loadHistory('search', query);
  }

  async function openImage(storageId: string) {
    try {
      await Linking.openURL(await getStorageViewUrl(storageId));
    } catch {
      showDialog('Không mở được ảnh', 'Vui lòng thử lại.');
    }
  }

  async function handleRoleChange(nextRole: 'TENANT' | 'LANDLORD') {
    if (nextRole === role || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateParticipantRole(conversation.id, nextRole);
      setRole(updated.participantRole);
      onUpdated({ ...conversation, ...updated });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật nhãn');
    } finally {
      setSaving(false);
    }
  }

  if (historyMode) {
    const images = history.flatMap((message) =>
      (message.attachments ?? [])
        .filter((attachment) => attachment.contentType.startsWith('image/'))
        .map((attachment) => ({ ...attachment, messageId: message.id }))
    );
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-row items-center border-b border-border bg-surface px-4 py-3">
          <Pressable
            onPress={() => {
              requestId.current++;
              setHistoryMode(null);
            }}
            className="mr-3 px-1 py-2"
            accessibilityLabel="Quay lại chi tiết trò chuyện">
            <Ionicons name="chevron-back" size={26} className="text-foreground" />
          </Pressable>
          <Text className="text-lg font-bold text-foreground">
            {historyMode === 'images' ? 'Hình ảnh đã gửi' : 'Tìm kiếm tin nhắn'}
          </Text>
        </View>
        {historyMode === 'search' ? (
          <View className="flex-row items-center gap-2 border-b border-border bg-surface px-4 py-3">
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={submitSearch}
              placeholder="Nhập nội dung tin nhắn..."
              returnKeyType="search"
              className="flex-1 rounded-xl bg-muted px-4 py-3 text-foreground selection:text-primary placeholder:text-subtle"
              accessibilityLabel="Nội dung cần tìm"
            />
            <Pressable
              onPress={submitSearch}
              className="rounded-xl bg-brand px-4 py-3"
              accessibilityLabel="Tìm tin nhắn">
              <Ionicons name="search" size={20} className="text-on-brand" />
            </Pressable>
          </View>
        ) : null}
        <ScrollView className="flex-1" contentContainerClassName="px-4 py-5">
          {historyMode === 'images' ? (
            <View className="flex-row flex-wrap gap-2">
              {images.map((image) => (
                <Pressable
                  key={`${image.messageId}-${image.storageId}`}
                  onPress={() => void openImage(image.storageId)}
                  className="aspect-square w-[31%] items-center justify-center overflow-hidden rounded-xl bg-muted"
                  accessibilityLabel={`Mở ảnh ${image.fileName}`}>
                  {imageUrls[image.storageId] ? (
                    <Image source={{ uri: imageUrls[image.storageId] }} className="h-full w-full" />
                  ) : (
                    <Ionicons name="image-outline" size={30} className="text-subtle" />
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            history.map((message) => (
              <View
                key={message.id}
                className="mb-3 rounded-2xl border border-border bg-surface p-4">
                <Text className="text-xs text-muted-foreground">
                  {message.senderId === conversation.participantId
                    ? conversation.participantName || 'Người kia'
                    : 'Bạn'}
                  {' · '}
                  {new Date(message.createdAt).toLocaleString('vi-VN')}
                </Text>
                <Text className="mt-2 text-sm leading-5 text-foreground">{message.content}</Text>
              </View>
            ))
          )}
          {historyLoading ? <ActivityIndicator className="my-5 text-primary" /> : null}
          {historyMode === 'search' && !submittedKeyword && !historyLoading ? (
            <Text className="py-8 text-center text-muted-foreground">
              Nhập từ khóa để tìm trong cuộc trò chuyện
            </Text>
          ) : null}
          {historyError ? (
            <Pressable
              onPress={() => void loadHistory(historyMode, submittedKeyword, nextBefore)}
              className="my-4 rounded-xl bg-danger-soft p-3">
              <Text className="text-center text-danger">{historyError} · Thử lại</Text>
            </Pressable>
          ) : null}
          {!historyLoading &&
          !historyError &&
          !nextBefore &&
          (historyMode === 'images' || submittedKeyword) &&
          !history.length ? (
            <Text className="py-8 text-center text-muted-foreground">
              {historyMode === 'images' ? 'Chưa có hình ảnh nào' : 'Không tìm thấy tin nhắn'}
            </Text>
          ) : null}
          {!historyLoading && !historyError && nextBefore ? (
            <Pressable
              onPress={() => void loadHistory(historyMode, submittedKeyword, nextBefore)}
              className="my-4 rounded-xl bg-primary-soft px-4 py-3">
              <Text className="text-center font-semibold text-primary">Xem thêm</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-border bg-surface px-4 py-3">
        <Pressable onPress={onBack} className="mr-3 px-1 py-2">
          <Ionicons name="chevron-back" size={26} className="text-foreground" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground">Chi tiết trò chuyện</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 py-6">
        <View className="items-center rounded-3xl border border-border bg-surface p-6">
          <Avatar
            uri={conversation.participantAvatar}
            name={conversation.participantName || conversation.participantEmail || 'HomeSpace'}
            size={76}
          />
          <Text className="mt-3 text-xl font-bold text-foreground">
            {conversation.participantName ||
              conversation.participantEmail ||
              'Người dùng HomeSpace'}
          </Text>
          {conversation.participantEmail ? (
            <Text className="mt-1 text-sm text-muted-foreground">
              {conversation.participantEmail}
            </Text>
          ) : null}
          <View className="mt-3 rounded-full bg-primary-soft px-3 py-1.5">
            <Text className="text-xs font-bold text-primary">{roleLabel(role)}</Text>
          </View>
        </View>

        <View className="mt-5 rounded-3xl border border-border bg-surface p-4">
          <Text className="text-base font-bold text-foreground">Nội dung trò chuyện</Text>
          <Pressable
            onPress={() => openHistory('search')}
            className="mt-3 flex-row items-center rounded-2xl bg-muted p-4"
            accessibilityLabel="Tìm kiếm tin nhắn">
            <Ionicons name="search-outline" size={21} className="text-primary" />
            <Text className="ml-3 flex-1 font-semibold text-foreground">Tìm kiếm tin nhắn</Text>
            <Ionicons name="chevron-forward" size={18} className="text-subtle" />
          </Pressable>
          <Pressable
            onPress={() => openHistory('images')}
            className="mt-3 flex-row items-center rounded-2xl bg-muted p-4"
            accessibilityLabel="Xem lịch sử hình ảnh">
            <Ionicons name="images-outline" size={21} className="text-primary" />
            <Text className="ml-3 flex-1 font-semibold text-foreground">Lịch sử hình ảnh</Text>
            <Ionicons name="chevron-forward" size={18} className="text-subtle" />
          </Pressable>
        </View>

        <View className="mt-5 rounded-3xl border border-border bg-surface p-4">
          <Text className="text-base font-bold text-foreground">Nhãn participant</Text>
          <Text className="mt-1 text-sm leading-5 text-muted-foreground">
            Gán vai trò để dễ phân loại người hỏi thuê và chủ thuê.
          </Text>
          <View className="mt-4 gap-3">
            {ROLE_OPTIONS.map((option) => {
              const selected = option.value === role;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleRoleChange(option.value)}
                  className={`flex-row items-center rounded-2xl border p-4 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                  <Ionicons
                    name={option.icon}
                    size={21}
                    className={selected ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <Text
                    className={`ml-3 flex-1 text-sm font-bold ${selected ? 'text-primary' : 'text-secondary'}`}>
                    {option.label}
                  </Text>
                  {saving && selected ? (
                    <ActivityIndicator className="text-primary" />
                  ) : selected ? (
                    <Ionicons name="checkmark-circle" size={21} className="text-primary" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {error ? <Text className="mt-3 text-xs text-danger">{error}</Text> : null}
        </View>

        {conversation.listing ? (
          <View className="mt-5 rounded-3xl border border-border bg-surface p-4">
            <Text className="text-base font-bold text-foreground">Bài đăng liên quan</Text>
            <View className="mt-3 flex-row">
              <Image
                source={{ uri: listingImage(conversation.listing.image) }}
                className="h-20 w-24 rounded-2xl bg-muted"
              />
              <View className="ml-3 flex-1 justify-center">
                <Text className="text-sm font-bold text-foreground" numberOfLines={2}>
                  {conversation.listing.title}
                </Text>
                <Text className="mt-1 text-xs font-bold text-primary">
                  {conversation.listing.price}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
                  {conversation.listing.location}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
