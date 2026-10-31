import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@/components/Icon';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import {
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  type ChatConversation,
  type ChatMessage,
} from '@/services/chatApi';
import { listingImage } from '@/services/listingApi';
import { getStorageViewUrl, uploadChatAttachment } from '@/services/storageApi';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';

function conversationName(conversation: ChatConversation) {
  return (
    conversation.participantName || conversation.participantEmail || conversation.participantId
  );
}

function participantRoleLabel(role?: ChatConversation['participantRole']) {
  return role === 'TENANT' ? 'Người hỏi thuê' : role === 'LANDLORD' ? 'Chủ thuê' : null;
}

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

type PendingAttachment = {
  uri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

function MessageAttachment({
  storageId,
  fileName,
  contentType,
  mine,
}: {
  storageId: string;
  fileName: string;
  contentType: string;
  mine: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getStorageViewUrl(storageId)
      .then(setUrl)
      .catch(() => undefined);
  }, [storageId]);

  return (
    <Pressable
      disabled={!url}
      onPress={() => url && void Linking.openURL(url)}
      className={`mb-2 flex-row items-center rounded-xl px-2 py-1 ${mine ? 'bg-on-brand/15' : 'bg-primary-soft'}`}>
      <Ionicons
        name={contentType.startsWith('image/') ? 'image' : 'document'}
        size={18}
        className={mine ? 'text-on-brand' : 'text-primary'}
      />
      <Text
        className={`ml-2 max-w-[180px] text-xs ${mine ? 'text-on-brand' : 'text-secondary'}`}
        numberOfLines={1}>
        {fileName}
      </Text>
    </Pressable>
  );
}

export default function MessagesScreen({
  initialConversationId,
  onSelectTab,
  onOpenConversationDetails,
}: {
  initialConversationId?: string | null;
  onSelectTab: (tab: MainTab) => void;
  onOpenConversationDetails: (conversation: ChatConversation) => void;
}) {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const initialOpenedId = useRef<string | null>(null);
  const listingAttachedIds = useRef(new Set<string>());

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [currentProfile, items] = await Promise.all([getUserProfileApi(), listConversations()]);
      setProfile(currentProfile);
      setConversations(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được cuộc trò chuyện');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter(
      (conversation) =>
        conversationName(conversation).toLowerCase().includes(keyword) ||
        conversation.lastMessage?.toLowerCase().includes(keyword) ||
        conversation.listing?.title.toLowerCase().includes(keyword)
    );
  }, [conversations, search]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  const openConversation = useCallback(async (conversation: ChatConversation) => {
    setSelectedId(conversation.id);
    setMessages([]);
    setMessageError(null);
    setMessagesLoading(true);
    try {
      const page = await listMessages(conversation.id);
      setMessages(page.items ?? []);
      await markConversationRead(conversation.id).catch(() => undefined);
      setConversations((current) =>
        current.map((item) => (item.id === conversation.id ? { ...item, unreadCount: 0 } : item))
      );
    } catch (loadError) {
      setMessageError(
        loadError instanceof Error ? loadError.message : 'Không tải được nội dung cuộc trò chuyện'
      );
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialConversationId) {
      initialOpenedId.current = null;
      return;
    }
    if (loading || selectedId || initialOpenedId.current === initialConversationId) return;
    const conversation = conversations.find((item) => item.id === initialConversationId);
    if (conversation) {
      initialOpenedId.current = initialConversationId;
      void openConversation(conversation);
    }
  }, [conversations, initialConversationId, loading, openConversation, selectedId]);

  async function handleSend() {
    const content = draft.trim();
    if ((!content && !pendingAttachment) || !selected || sending) return;
    setSending(true);
    setMessageError(null);
    try {
      const name = profile
        ? [profile.lastName, profile.firstName].filter(Boolean).join(' ') || profile.username
        : undefined;
      const listing =
        selected.id === initialConversationId &&
        selected.listing &&
        !listingAttachedIds.current.has(selected.id) &&
        !messages.some((message) => message.listing?.id === selected.listing?.id)
          ? selected.listing
          : undefined;
      const attachment = pendingAttachment
        ? await uploadChatAttachment(
            pendingAttachment.uri,
            pendingAttachment.fileName,
            pendingAttachment.contentType,
            pendingAttachment.sizeBytes,
            selected.id
          )
        : undefined;
      const message = await sendMessage(
        selected.id,
        content || `Đã gửi ${pendingAttachment?.fileName ?? 'tệp đính kèm'}`,
        listing,
        {
          displayName: name,
          email: profile?.email,
          avatarUrl: profile?.avatarUrl ?? undefined,
        },
        attachment ? [attachment] : undefined
      );
      if (listing) listingAttachedIds.current.add(selected.id);
      setMessages((current) => [...current, message]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selected.id
            ? {
                ...conversation,
                lastMessage: message.content,
                lastMessageAt: message.createdAt,
                lastMessageSenderId: message.senderId,
              }
            : conversation
        )
      );
      setDraft('');
      setPendingAttachment(null);
    } catch (sendError) {
      setMessageError(sendError instanceof Error ? sendError.message : 'Không gửi được tin nhắn');
    } finally {
      setSending(false);
    }
  }

  function chooseAttachment() {
    Alert.alert('Đính kèm tin nhắn', 'Chọn loại tệp muốn gửi', [
      { text: 'Ảnh', onPress: () => void pickImage() },
      { text: 'Tệp', onPress: () => void pickDocument() },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessageError('Cần cấp quyền thư viện ảnh để gửi ảnh');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingAttachment({
      uri: asset.uri,
      fileName: asset.fileName || `image-${Date.now()}.jpg`,
      contentType: asset.mimeType || 'image/jpeg',
      sizeBytes: asset.fileSize || 1,
    });
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingAttachment({
      uri: asset.uri,
      fileName: asset.name,
      contentType: asset.mimeType || 'application/octet-stream',
      sizeBytes: asset.size || 1,
    });
  }

  if (selected) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
          <View className="flex-row items-center border-b border-border bg-surface px-4 py-3">
            <Pressable onPress={() => setSelectedId(null)} className="mr-3 px-1 py-2">
              <Ionicons name="chevron-back" size={26} className="text-foreground" />
            </Pressable>
            <Avatar uri={selected.participantAvatar} name={conversationName(selected)} size={46} />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-foreground" numberOfLines={1}>
                {conversationName(selected)}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">Người dùng HomeSpace</Text>
            </View>
            <Pressable
              onPress={() => onOpenConversationDetails(selected)}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
              <Ionicons name="information-circle-outline" size={23} className="text-primary" />
            </Pressable>
          </View>

          {selected.listing ? (
            <View className="mx-4 mt-3 flex-row rounded-2xl border border-border bg-surface p-3">
              <Image
                source={{ uri: listingImage(selected.listing.image) }}
                className="h-14 w-16 rounded-xl bg-muted"
              />
              <View className="ml-3 flex-1">
                <Text className="text-xs font-semibold text-foreground" numberOfLines={2}>
                  {selected.listing.title}
                </Text>
                <Text className="mt-1 text-xs font-bold text-primary">
                  {selected.listing.price}
                </Text>
              </View>
            </View>
          ) : null}

          <ScrollView
            className="flex-1 px-4"
            contentContainerClassName="py-5"
            keyboardShouldPersistTaps="handled">
            {messagesLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator className="text-primary" />
                <Text className="mt-3 text-sm text-muted-foreground">Đang tải tin nhắn...</Text>
              </View>
            ) : messageError && !messages.length ? (
              <View className="items-center py-12">
                <Ionicons name="cloud-offline-outline" size={36} className="text-subtle" />
                <Text className="mt-3 text-center text-sm text-muted-foreground">
                  {messageError}
                </Text>
                <Pressable
                  onPress={() => openConversation(selected)}
                  className="mt-4 rounded-xl bg-brand px-4 py-2.5">
                  <Text className="font-semibold text-on-brand">Thử lại</Text>
                </Pressable>
              </View>
            ) : messages.length ? (
              messages.map((message) => {
                const mine = message.senderId === profile?.id;
                return (
                  <View
                    key={message.id}
                    className={`mb-3 max-w-[82%] ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
                    <View
                      className={`rounded-2xl px-4 py-3 ${mine ? 'rounded-br-sm bg-brand' : 'rounded-bl-sm border border-border bg-surface'}`}>
                      {message.attachments?.map((attachment) => (
                        <MessageAttachment
                          key={attachment.storageId}
                          storageId={attachment.storageId}
                          fileName={attachment.fileName}
                          contentType={attachment.contentType}
                          mine={mine}
                        />
                      ))}
                      <Text
                        className={`text-sm leading-5 ${mine ? 'text-on-brand' : 'text-foreground'}`}>
                        {message.content}
                      </Text>
                    </View>
                    <Text className="mt-1 px-1 text-[10px] text-subtle">
                      {formatTime(message.createdAt)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View className="items-center py-12">
                <Ionicons name="chatbubbles-outline" size={38} className="text-subtle" />
                <Text className="mt-3 text-sm text-muted-foreground">
                  Hãy bắt đầu cuộc trò chuyện
                </Text>
              </View>
            )}
          </ScrollView>

          {messageError && messages.length ? (
            <Text className="bg-danger-soft px-4 py-2 text-center text-xs text-danger">
              {messageError}
            </Text>
          ) : null}

          {pendingAttachment ? (
            <View className="flex-row items-center border-t border-border bg-surface px-4 pb-2 pt-2">
              <Ionicons name="attach" size={16} className="text-primary" />
              <Text className="ml-2 flex-1 text-xs text-secondary" numberOfLines={1}>
                {pendingAttachment.fileName}
              </Text>
              <Pressable onPress={() => setPendingAttachment(null)}>
                <Ionicons name="close-circle" size={19} className="text-subtle" />
              </Pressable>
            </View>
          ) : null}

          <View className="flex-row items-end gap-2 border-t border-border bg-surface px-4 py-3">
            <Pressable
              onPress={chooseAttachment}
              className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Ionicons name="add" size={24} className="text-muted-foreground" />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              placeholder="Nhập tin nhắn..."
              multiline
              editable={!sending}
              className="max-h-28 flex-1 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              className={`h-11 w-11 items-center justify-center rounded-full ${draft.trim() && !sending ? 'bg-brand' : 'bg-disabled'}`}>
              {sending ? (
                <ActivityIndicator size="small" className="text-on-disabled" />
              ) : (
                <Ionicons
                  name="send"
                  size={19}
                  className={draft.trim() && !sending ? 'text-on-brand' : 'text-on-disabled'}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="border-b border-border bg-surface px-5 pb-4 pt-2">
        <Image
          source={require('../../assets/homespace-horizontal-logo.png')}
          resizeMode="contain"
          className="h-10 w-36"
        />
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">Tin nhắn</Text>
          <View className="h-9 min-w-9 items-center justify-center rounded-full bg-primary-soft px-2">
            <Text className="text-xs font-bold text-primary">
              {conversations.reduce((total, item) => total + item.unreadCount, 0)}
            </Text>
          </View>
        </View>
        <View className="mt-4 flex-row items-center rounded-2xl bg-muted px-4">
          <Ionicons name="search-outline" size={19} className="text-subtle" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm cuộc trò chuyện..."
            className="ml-2 flex-1 py-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerClassName="py-2">
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator className="text-primary" />
            <Text className="mt-3 text-sm text-muted-foreground">Đang kết nối tin nhắn...</Text>
          </View>
        ) : error ? (
          <View className="mx-5 items-center rounded-3xl border border-border bg-surface px-6 py-12">
            <Ionicons name="cloud-offline-outline" size={38} className="text-subtle" />
            <Text className="mt-3 text-center font-bold text-foreground">
              Không thể kết nối chat backend
            </Text>
            <Text className="mt-1 text-center text-xs text-muted-foreground">{error}</Text>
            <Pressable onPress={() => load()} className="mt-4 rounded-xl bg-brand px-5 py-3">
              <Text className="font-semibold text-on-brand">Thử lại</Text>
            </Pressable>
          </View>
        ) : filtered.length ? (
          filtered.map((conversation) => (
            <Pressable
              key={conversation.id}
              onPress={() => openConversation(conversation)}
              className="mx-3 flex-row items-center rounded-2xl px-3 py-4 active:bg-surface">
              <Avatar
                uri={conversation.participantAvatar}
                name={conversationName(conversation)}
                size={50}
              />
              <View className="ml-3 flex-1">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center">
                    <Text className="shrink font-bold text-foreground" numberOfLines={1}>
                      {conversationName(conversation)}
                    </Text>
                    {participantRoleLabel(conversation.participantRole) ? (
                      <Text className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {participantRoleLabel(conversation.participantRole)}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="ml-2 text-[11px] text-subtle">
                    {formatTime(conversation.lastMessageAt)}
                  </Text>
                </View>
                <View className="mt-1 flex-row items-center">
                  <Text
                    className="flex-1 text-sm leading-5 text-muted-foreground"
                    numberOfLines={1}>
                    {conversation.lastMessage || 'Chưa có tin nhắn'}
                  </Text>
                  {conversation.unreadCount ? (
                    <View className="ml-2 h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
                      <Text className="text-[10px] font-bold text-on-brand">
                        {conversation.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <View className="items-center px-6 py-16">
            <Image
              source={require('../../assets/homespace-logo.png')}
              resizeMode="contain"
              className="h-20 w-20 opacity-70"
            />
            <Text className="mt-4 font-bold text-foreground">Chưa có cuộc trò chuyện</Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Mở một bài đăng và nhắn tin với chủ nhà để bắt đầu.
            </Text>
          </View>
        )}
      </ScrollView>

      <BottomTabBar active="messages" onSelect={onSelectTab} />
    </SafeAreaView>
  );
}
