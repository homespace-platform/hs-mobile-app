import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@/components/Icon';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  AppState,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
import TabHeader from '@/components/TabHeader';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import { useDialog } from '@/components/AppDialog';
import ChatDocument from '@/components/chat/ChatDocument';
import ChatImageViewer, { ChatImageThumbnail } from '@/components/chat/ChatImageViewer';
import { useChatCalls } from '@/components/chat/ChatCallProvider';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import {
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  type ChatAttachment,
  type ChatCallHistory,
  type ChatConversation,
  type ChatMessage,
  type RelatedListing,
} from '@/services/chatApi';
import {
  chatMessageCaption,
  dedupeConversationsByParticipant,
  shouldAttachPendingListing,
} from '@/lib/chat-threads';
import {
  applyChatMessage,
  isLatestChatMessage,
  readChatCallHistory,
  toChatMessage,
} from '@/lib/realtime/pure';
import PresenceLabel from '@/components/PresenceLabel';
import { useChatPresence } from '@/lib/use-chat-presence';
import { useChatParticipantProfiles } from '@/lib/use-chat-participant-profiles';
import {
  emitChatWithAck,
  isChatSocketConnected,
  subscribeChatEvents,
} from '@/lib/realtime/connections';
import { chatUnreadStore } from '@/lib/unread-store';
import { listingImage } from '@/services/listingApi';
import {
  CHAT_DOCUMENT_TYPES,
  chatAttachmentIcon,
  prepareChatAttachment,
  uploadChatAttachment,
} from '@/services/chatMediaApi';
import { fileSessionGuard, withFileLease } from '@/services/rental/cache';
import type { LocalFile } from '@/services/storageApi';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';

const CALL_OPTIONS = [
  { mode: 'voice', label: 'Gọi thoại', icon: 'call-outline' },
  { mode: 'video', label: 'Gọi video', icon: 'videocam-outline' },
] as const;

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

const MAX_ATTACHMENTS = 5;
const CALL_STATUS: Record<ChatCallHistory['status'], string> = {
  missed: 'Cuộc gọi nhỡ',
  declined: 'Đã từ chối',
  cancelled: 'Đã hủy',
  ended: 'Đã kết thúc',
  failed: 'Không kết nối được',
};

type ComposerDraft = {
  text: string;
  attachments: (LocalFile & { uploaded?: ChatAttachment })[];
  error?: string;
};

const EMPTY_DRAFT: ComposerDraft = { text: '', attachments: [] };

function ListingCard({ listing, mine, onOpen }: { listing: RelatedListing; mine: boolean; onOpen: () => void }) {
  return (
    <View
      className={`mt-1 w-64 max-w-full flex-row items-center rounded-2xl border border-border bg-surface p-2 ${mine ? 'self-end' : 'self-start'}`}>
      <Image
        source={{ uri: listingImage(listing.image) }}
        className="h-14 w-16 rounded-xl bg-muted"
      />
      <View className="ml-3 min-w-0 flex-1">
        <Text className="text-xs font-semibold text-foreground" numberOfLines={2}>
          {listing.title}
        </Text>
        <Text className="mt-1 text-xs font-bold text-primary">{listing.price}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem tin đăng ${listing.title}`}
        onPress={onOpen}
        className="ml-2 min-h-11 min-w-11 shrink-0 flex-row items-center justify-center gap-1 rounded-lg bg-primary/10 px-2 active:opacity-70">
        <Text className="text-xs font-semibold text-primary">Xem</Text>
        <Ionicons name="open-outline" size={13} className="text-primary" />
      </Pressable>
    </View>
  );
}

export default function MessagesScreen({
  initialConversationId,
  pendingListing,
  onPendingListingConsumed,
  onSelectTab,
  onOpenConversationDetails,
  onOpenListing,
}: {
  initialConversationId?: string | null;
  pendingListing?: RelatedListing | null;
  onPendingListingConsumed?: () => void;
  onSelectTab: (tab: MainTab) => void;
  onOpenConversationDetails: (conversation: ChatConversation) => void;
  onOpenListing: (listingId: string, conversationId: string) => void;
}) {
  const showDialog = useDialog();
  const { session, startCall } = useChatCalls();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [rawConversations, setConversations] = useState<ChatConversation[]>([]);
  const [profileRefreshVersion, setProfileRefreshVersion] = useState(0);
  const participantIds = rawConversations.map((item) => item.participantId);
  const presence = useChatPresence(participantIds);
  const participantProfiles = useChatParticipantProfiles(participantIds, profileRefreshVersion);
  const conversations = useMemo(() => rawConversations.map((item) => ({
    ...item,
    ...participantProfiles[item.participantId],
  })), [rawConversations, participantProfiles]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, ComposerDraft>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const pickingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ images: ChatAttachment[]; index: number } | null>(null);
  const initialOpenedId = useRef<string | null>(null);
  const initialIdRef = useRef(initialConversationId);
  initialIdRef.current = initialConversationId;
  const seenMessageIds = useRef(new Set<string>());
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const lastLoadAt = useRef(0);

  const load = useCallback(async (refresh = false) => {
    lastLoadAt.current = Date.now();
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [currentProfile, items] = await Promise.all([getUserProfileApi(), listConversations()]);
      setProfile(currentProfile);
      setConversations(dedupeConversationsByParticipant(items, initialIdRef.current));
      if (refresh) setProfileRefreshVersion((version) => version + 1);
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
        conversation.lastMessage?.toLowerCase().includes(keyword)
    );
  }, [conversations, search]);

  // Keeps the Messages tab badge in sync with what this screen shows.
  useEffect(() => {
    if (!loading)
      chatUnreadStore.dispatch({
        type: 'set',
        count: conversations.reduce((total, item) => total + item.unreadCount, 0),
      });
  }, [conversations, loading]);

  // Silent reload (no spinner) used by chat pushes, socket reconnects and the polling fallback.
  const selectedIdRef = useRef(selectedId);
  const quietRefresh = useCallback(async () => {
    lastLoadAt.current = Date.now();
    try {
      const items = dedupeConversationsByParticipant(
        await listConversations(),
        selectedIdRef.current ?? initialIdRef.current
      );
      const openId = selectedIdRef.current;
      setConversations(
        openId
          ? items.map((item) => (item.id === openId ? { ...item, unreadCount: 0 } : item))
          : items
      );
      if (openId) {
        const page = await listMessages(openId);
        if (selectedIdRef.current !== openId) return;
        setMessages(page.items ?? []);
        await markConversationRead(openId).catch(() => undefined);
      }
    } catch {
      // Keep what is on screen; the next event or poll retries.
    }
  }, []);

  // Fallback: while the chat socket is down, poll every 15s so the screen never needs a manual refresh.
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && !isChatSocketConnected()) void quietRefresh();
    }, 15_000);
    return () => clearInterval(timer);
  }, [quietRefresh]);

  // Realtime chat (Gateway chat socket): new messages update the list/unread count and the open thread.
  const myId = profile?.id;
  useEffect(
    () =>
      subscribeChatEvents((event, payload) => {
        if (event === 'connect' || event === 'chat:refresh') {
          if (Date.now() - lastLoadAt.current < 1500) return;
          void quietRefresh();
          return;
        }
        if (event !== 'chat:message') return;
        const message = toChatMessage(payload);
        if (!message || seenMessageIds.current.has(message.id)) return;
        seenMessageIds.current.add(message.id);
        // shortcut: retain 500 ids; fine for one session of a phone chat.
        if (seenMessageIds.current.size > 500)
          seenMessageIds.current.delete(seenMessageIds.current.values().next().value!);
        const result = applyChatMessage(conversationsRef.current, message, {
          myId,
          openId: selectedId,
        });
        if (result.unknown) {
          void load(true);
          return;
        }
        setConversations((current) =>
          applyChatMessage(current, message, { myId, openId: selectedId }).conversations
        );
        if (result.appendToOpen)
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message]
          );
        if (result.markRead)
          void markConversationRead(message.conversationId).catch(() => undefined);
      }),
    [load, myId, quietRefresh, selectedId]
  );

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const draft = (selected && drafts[selected.id]) || EMPTY_DRAFT;
  const canSend = Boolean(draft.text.trim() || draft.attachments.length) && !sending;

  function updateDraft(id: string, update: (draft: ComposerDraft) => ComposerDraft) {
    setDrafts((current) => ({ ...current, [id]: update(current[id] ?? EMPTY_DRAFT) }));
  }

  const openConversation = useCallback(async (conversation: ChatConversation) => {
    selectedIdRef.current = conversation.id;
    setSelectedId(conversation.id);
    setMessages([]);
    setMessageError(null);
    setMessagesLoading(true);
    try {
      const page = await listMessages(conversation.id);
      if (selectedIdRef.current !== conversation.id) return;
      setMessages(page.items ?? []);
      await markConversationRead(conversation.id).catch(() => undefined);
      setConversations((current) =>
        current.map((item) => (item.id === conversation.id ? { ...item, unreadCount: 0 } : item))
      );
    } catch (loadError) {
      if (selectedIdRef.current === conversation.id)
        setMessageError(
          loadError instanceof Error ? loadError.message : 'Không tải được nội dung cuộc trò chuyện'
        );
    } finally {
      if (selectedIdRef.current === conversation.id) setMessagesLoading(false);
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

  // Listing context carried over from the listing detail: attached to the next message, once.
  const activeListing =
    selected &&
    selected.id === initialConversationId &&
    !messagesLoading &&
    shouldAttachPendingListing(pendingListing, messages, profile?.id)
      ? pendingListing!
      : null;

  async function handleSend() {
    if (!selected || !canSend || sendingRef.current || pickingRef.current) return;
    const conversationId = selected.id;
    const content = draft.text.trim();
    sendingRef.current = true;
    setSending(true);
    updateDraft(conversationId, (current) => ({ ...current, error: undefined }));
    try {
      const name = profile
        ? [profile.lastName, profile.firstName].filter(Boolean).join(' ') || profile.username
        : undefined;
      const listing = activeListing ?? undefined;
      const senderProfile = {
        displayName: name,
        email: profile?.email,
        avatarUrl: profile?.avatarUrl ?? undefined,
      };
      const attachments: ChatAttachment[] = [];
      const checkSession = fileSessionGuard();
      // The whole batch is leased: a sign-out must not delete a file still waiting its turn.
      await withFileLease(
        draft.attachments.map((file) => file.uri),
        async () => {
          for (const file of draft.attachments) {
            checkSession();
            const uploaded = file.uploaded ?? (await uploadChatAttachment(conversationId, file));
            attachments.push(uploaded);
            if (!file.uploaded) {
              updateDraft(conversationId, (current) => ({
                ...current,
                attachments: current.attachments.map((item) =>
                  item.uri === file.uri ? { ...item, uploaded } : item
                ),
              }));
            }
          }
        }
      );

      checkSession();
      let message: ChatMessage | null;
      if (isChatSocketConnected()) {
        const { ok, ack } = await emitChatWithAck(
          'chat:send',
          {
            conversationId,
            content,
            senderProfile,
            ...(listing ? { listing } : {}),
            ...(attachments.length ? { attachments } : {}),
          },
          15_000
        );
        message = ok ? toChatMessage(ack) : null;
      } else {
        message = await sendMessage(conversationId, content, listing, senderProfile, attachments);
      }
      checkSession();
      if (!message || message.conversationId !== conversationId)
        throw new Error('Chưa xác nhận được tin nhắn. Vui lòng thử lại.');
      if (listing) onPendingListingConsumed?.();
      // The chat socket may deliver the same message first.
      const confirmed = message;
      if (selectedIdRef.current === conversationId) {
        setMessages((current) =>
          current.some((item) => item.id === confirmed.id) ? current : [...current, confirmed]
        );
      }
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId &&
          isLatestChatMessage(conversation, confirmed)
            ? {
                ...conversation,
                lastMessage: chatMessageCaption(confirmed) || confirmed.attachments?.[0]?.fileName,
                lastMessageAt: confirmed.createdAt,
                lastMessageId: confirmed.id,
                lastMessageSenderId: confirmed.senderId,
              }
            : conversation
        )
      );
      updateDraft(conversationId, () => EMPTY_DRAFT);
    } catch (sendError) {
      updateDraft(conversationId, (current) => ({
        ...current,
        error: sendError instanceof Error ? sendError.message : 'Không gửi được tin nhắn',
      }));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function chooseAttachment() {
    if (
      !selected ||
      sendingRef.current ||
      pickingRef.current ||
      draft.attachments.length >= MAX_ATTACHMENTS
    )
      return;
    const conversationId = selected.id;
    const available = MAX_ATTACHMENTS - draft.attachments.length;
    showDialog('Đính kèm tin nhắn', 'Chọn loại tệp muốn gửi', [
      { text: 'Ảnh', onPress: () => void pickAttachments('images', conversationId, available) },
      { text: 'Tệp', onPress: () => void pickAttachments('documents', conversationId, available) },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  async function pickAttachments(
    kind: 'images' | 'documents',
    conversationId: string,
    available: number
  ) {
    if (pickingRef.current || sendingRef.current || selectedIdRef.current !== conversationId)
      return;
    pickingRef.current = true;
    try {
      let files: (Omit<LocalFile, 'sizeBytes'> & { sizeBytes?: number })[];
      if (kind === 'images') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: available > 1,
          selectionLimit: available,
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          // Android's lossy export can re-encode WebP as JPEG while reporting the original MIME type.
          quality: Platform.OS === 'android' ? 1 : 0.85,
        });
        if (result.canceled) return;
        files = result.assets.map((asset, index) => ({
          uri: asset.uri,
          fileName:
            asset.fileName ||
            `image-${Date.now()}-${index}.${asset.mimeType?.split('/')[1] || 'jpg'}`,
          contentType: asset.mimeType ?? '',
          sizeBytes: asset.fileSize,
        }));
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: available > 1,
          type: CHAT_DOCUMENT_TYPES,
        });
        if (result.canceled) return;
        files = result.assets.map((asset) => ({
          uri: asset.uri,
          fileName: asset.name,
          contentType: asset.mimeType ?? '',
          sizeBytes: asset.size,
        }));
      }
      const results = await Promise.allSettled(
        files.slice(0, available).map(prepareChatAttachment)
      );
      const rejected = results.find((result) => result.status === 'rejected');
      const picked = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      );
      updateDraft(conversationId, (current) => ({
        ...current,
        attachments: [...current.attachments, ...picked]
          .filter((file, index, all) => all.findIndex((item) => item.uri === file.uri) === index)
          .slice(0, MAX_ATTACHMENTS),
        error:
          rejected?.reason instanceof Error
            ? rejected.reason.message
            : files.length > available
              ? 'Chỉ có thể gửi tối đa 5 tệp mỗi tin nhắn.'
              : undefined,
      }));
    } catch {
      updateDraft(conversationId, (current) => ({
        ...current,
        error: 'Không chọn được tệp. Vui lòng thử lại.',
      }));
    } finally {
      pickingRef.current = false;
    }
  }

  function openImage(messageId: string, storageId: string) {
    const images = messages.flatMap((message) =>
      (message.attachments ?? [])
        .filter((file) => file.contentType.startsWith('image/'))
        .map((file) => ({ ...file, messageId: message.id }))
    );
    const index = images.findIndex(
      (file) => file.messageId === messageId && file.storageId === storageId
    );
    if (index >= 0) {
      Keyboard.dismiss();
      setViewer({ images, index });
    }
  }

  if (selected) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
          <View className="flex-row items-center border-b border-border bg-surface px-4 py-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại danh sách tin nhắn"
              onPress={() => {
                selectedIdRef.current = null;
                setSelectedId(null);
                setViewer(null);
              }}
              className="mr-3 px-1 py-2">
              <Ionicons name="chevron-back" size={26} className="text-foreground" />
            </Pressable>
            <Avatar
              uri={selected.participantAvatar}
              name={conversationName(selected)}
              size={46}
              online={presence[selected.participantId]?.online ?? false}
            />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-foreground" numberOfLines={1}>
                {conversationName(selected)}
              </Text>
              <PresenceLabel
                presence={presence[selected.participantId]}
                className="mt-0.5 text-xs"
              />
            </View>
            <View className="ml-2 flex-row items-center gap-1">
              {selected.participantId
                ? CALL_OPTIONS.map(({ mode, label, icon }) => {
                    const busy =
                      session?.phase === 'inviting' &&
                      session.call.conversationId === selected.id &&
                      session.call.mode === mode;
                    return (
                      <Pressable
                        key={mode}
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        accessibilityState={{ disabled: Boolean(session), busy }}
                        disabled={Boolean(session)}
                        onPress={() =>
                          void startCall(selected.id, mode, conversationName(selected))
                        }
                        className={`h-11 w-11 items-center justify-center rounded-full ${session ? 'bg-disabled' : 'bg-primary-soft'}`}>
                        {busy ? (
                          <ActivityIndicator className="text-on-disabled" />
                        ) : (
                          <Ionicons
                            name={icon}
                            size={21}
                            className={session ? 'text-on-disabled' : 'text-primary'}
                          />
                        )}
                      </Pressable>
                    );
                  })
                : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thông tin cuộc trò chuyện"
                onPress={() => onOpenConversationDetails(selected)}
                className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
                <Ionicons name="information-circle-outline" size={23} className="text-primary" />
              </Pressable>
            </View>
          </View>

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
                const listing = message.listing;
                const caption = chatMessageCaption(message);
                const call = readChatCallHistory(message.call);
                const callback = call?.mode === 'video' ? CALL_OPTIONS[1] : CALL_OPTIONS[0];
                return (
                  <View
                    key={message.id}
                    className={`mb-3 max-w-[82%] ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
                    {call ? (
                      <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                        <Ionicons name={callback.icon} size={23} className="text-primary" />
                        <View className="shrink">
                          <Text className="font-semibold text-foreground">
                            {CALL_STATUS[call.status]}
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            {callback.label} ·{' '}
                            {call.callerId === myId ? 'Cuộc gọi đi' : 'Cuộc gọi đến'}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Gọi lại · ${callback.label}`}
                          disabled={Boolean(session)}
                          onPress={() =>
                            void startCall(selected.id, callback.mode, conversationName(selected))
                          }
                          className="min-h-12 justify-center rounded-xl bg-primary-soft px-3 active:opacity-70 disabled:opacity-50">
                          <Text className="text-xs font-semibold text-primary">Gọi lại</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View
                        className={`gap-2 rounded-2xl px-4 py-3 ${mine ? 'rounded-br-sm bg-brand' : 'rounded-bl-sm border border-border bg-surface'}`}>
                        {message.attachments?.map((attachment) =>
                          attachment.contentType.startsWith('image/') ? (
                            <ChatImageThumbnail
                              key={attachment.storageId}
                              conversationId={message.conversationId}
                              image={attachment}
                              onPress={() => openImage(message.id, attachment.storageId)}
                              className="h-40 w-56 max-w-full"
                            />
                          ) : (
                            <ChatDocument
                              key={attachment.storageId}
                              conversationId={message.conversationId}
                              document={attachment}
                              mine={mine}
                            />
                          )
                        )}
                        {caption ? (
                          <Text
                            className={`text-sm leading-5 ${mine ? 'text-on-brand' : 'text-foreground'}`}>
                            {caption}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    {listing ? (
                      <ListingCard
                        listing={listing}
                        mine={mine}
                        onOpen={() => onOpenListing(listing.id, selected.id)}
                      />
                    ) : null}
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

          {activeListing ? (
            <View className="flex-row items-center border-t border-border bg-surface px-4 pb-2 pt-2">
              <Ionicons name="home-outline" size={16} className="text-primary" />
              <Text className="ml-2 flex-1 text-xs text-secondary" numberOfLines={1}>
                Đang hỏi về: {activeListing.title}
              </Text>
              <Pressable
                onPress={() => onPendingListingConsumed?.()}
                accessibilityLabel="Bỏ bài đăng đang hỏi">
                <Ionicons name="close-circle" size={19} className="text-subtle" />
              </Pressable>
            </View>
          ) : null}

          {draft.attachments.length ? (
            <View className="border-t border-border bg-surface">
              <Text className="px-4 pt-2 text-xs text-muted-foreground">
                {draft.attachments.length}/{MAX_ATTACHMENTS} tệp đính kèm
              </Text>
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                contentContainerClassName="gap-2 px-4 py-2">
                {draft.attachments.map((file) => (
                  <View
                    key={file.uri}
                    className="flex-row items-center gap-2 rounded-xl bg-muted pl-2">
                    {file.contentType.startsWith('image/') ? (
                      <Image
                        source={{ uri: file.uri }}
                        className="h-10 w-10 rounded-lg bg-surface"
                      />
                    ) : (
                      <Ionicons
                        name={chatAttachmentIcon(file)}
                        size={23}
                        className="text-primary"
                      />
                    )}
                    <Text className="max-w-[120px] text-xs text-foreground" numberOfLines={1}>
                      {file.fileName}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Bỏ tệp ${file.fileName}`}
                      disabled={sending}
                      onPress={() =>
                        updateDraft(selected.id, (current) => ({
                          ...current,
                          error: undefined,
                          attachments: current.attachments.filter((item) => item.uri !== file.uri),
                        }))
                      }
                      className="h-12 w-12 items-center justify-center disabled:opacity-40">
                      <Ionicons
                        name="close-circle-outline"
                        size={20}
                        className="text-muted-foreground"
                      />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {draft.error ? (
            <Text
              accessibilityLiveRegion="polite"
              className="bg-danger-soft px-4 py-2 text-center text-xs text-danger">
              {draft.error}
            </Text>
          ) : null}

          <View className="flex-row items-end gap-2 border-t border-border bg-surface px-4 py-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đính kèm tệp"
              disabled={sending || draft.attachments.length >= MAX_ATTACHMENTS}
              onPress={chooseAttachment}
              className="h-12 w-12 items-center justify-center rounded-full bg-muted disabled:opacity-50">
              <Ionicons name="add" size={24} className="text-muted-foreground" />
            </Pressable>
            <TextInput
              value={draft.text}
              onChangeText={(text) => updateDraft(selected.id, (current) => ({ ...current, text }))}
              onSubmitEditing={handleSend}
              placeholder={
                draft.attachments.length ? 'Thêm chú thích (không bắt buộc)' : 'Nhập tin nhắn...'
              }
              multiline
              editable={!sending}
              maxLength={5000}
              className="max-h-28 flex-1 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
              onPress={handleSend}
              disabled={!canSend}
              className={`h-12 w-12 items-center justify-center rounded-full ${canSend ? 'bg-brand' : 'bg-disabled'}`}>
              {sending ? (
                <ActivityIndicator size="small" className="text-on-disabled" />
              ) : (
                <Ionicons
                  name="send"
                  size={19}
                  className={canSend ? 'text-on-brand' : 'text-on-disabled'}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
        {viewer ? (
          <ChatImageViewer
            conversationId={selected.id}
            images={viewer.images}
            initialIndex={viewer.index}
            onClose={() => setViewer(null)}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <TabHeader title="Tin nhắn" profile={profile}>
        <View className="mt-4 flex-row items-center rounded-2xl bg-muted px-4">
          <Ionicons name="search-outline" size={19} className="text-subtle" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm cuộc trò chuyện..."
            className="ml-2 flex-1 py-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
          />
        </View>
      </TabHeader>
      <ProfileCompletionBanner />

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
                online={presence[conversation.participantId]?.online ?? false}
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
                    <View className="ml-2 h-5 w-6 shrink-0 items-center justify-center rounded-full bg-brand">
                      <Text
                        accessibilityLabel={`${conversation.unreadCount} tin chưa đọc`}
                        numberOfLines={1}
                        allowFontScaling={false}
                        className="text-[10px] font-bold text-on-brand">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
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
