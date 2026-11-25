// Pure realtime helpers (URL targets, backoff, event -> state reducers); node tests load this file.
import {
  isNotificationUnread,
  isVisibleNotification,
  NOTIFICATION_CATEGORIES,
  type NotificationFilterCategory,
  type NotificationItem,
} from '@/lib/notification';
import type { ChatConversation, ChatMessage } from '@/services/chatApi';

const URL_PARTS = /^(https?:\/\/[^/?#]+)(\/[^?#]*)?/i;

// Gateway websocket target, like the admin portal: Engine.IO path = <gateway prefix>/api/v1/<service>/socket.io.
export function gatewaySocketTarget(gatewayBaseUrl: string, service: 'chat' | 'notifications') {
  const match = URL_PARTS.exec(gatewayBaseUrl.trim());
  if (!match) return null;
  const prefix = (match[2] ?? '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  return { origin: match[1], path: `${prefix}/api/v1/${service}/socket.io` };
}

// The notification namespace checks the Origin header against an allowlist; RN sends none by itself.
export const normalizeOrigin = (value: string | undefined) =>
  value ? (URL_PARTS.exec(value.trim())?.[1] ?? undefined) : undefined;

// Exponential backoff 1s..30s with +/-20% jitter.
export const reconnectDelay = (attempt: number, random = Math.random) =>
  Math.round(Math.min(30_000, 1000 * 2 ** Math.max(0, attempt)) * (0.8 + random() * 0.4));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseNotificationItem(value: unknown): NotificationItem | null {
  if (!isRecord(value)) return null;
  const { id, category, title, body } = value;
  if (
    typeof id !== 'string' ||
    !id ||
    typeof title !== 'string' ||
    typeof body !== 'string' ||
    !(NOTIFICATION_CATEGORIES as readonly unknown[]).includes(category)
  )
    return null;
  return {
    id,
    category: category as NotificationItem['category'],
    type: typeof value.type === 'string' ? value.type : '',
    title,
    body,
    priority:
      (['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).find((p) => p === value.priority) ?? 'NORMAL',
    actionPath: typeof value.actionPath === 'string' ? value.actionPath : null,
    metadata: isRecord(value.metadata) ? (value.metadata as NotificationItem['metadata']) : null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    readAt: typeof value.readAt === 'string' ? value.readAt : null,
  };
}

export type NotificationListFilter = { tab: NotificationFilterCategory; unreadOnly: boolean };

// Applies notification:new/read/deleted to the loaded list; returns the same array when nothing changes.
export function applyNotificationEvent(
  items: NotificationItem[],
  event: string,
  payload: unknown,
  filter: NotificationListFilter,
  now = new Date().toISOString()
): NotificationItem[] {
  if (event === 'notification:new') {
    const item = parseNotificationItem(payload);
    if (
      !item ||
      !isVisibleNotification(item) ||
      items.some((existing) => existing.id === item.id) ||
      (filter.tab !== 'ALL' && item.category !== filter.tab) ||
      (filter.unreadOnly && !isNotificationUnread(item))
    )
      return items;
    return [item, ...items];
  }
  if (event === 'notification:deleted') {
    const id = isRecord(payload) ? payload.id : undefined;
    return items.some((item) => item.id === id) ? items.filter((item) => item.id !== id) : items;
  }
  if (event === 'notification:read') {
    if (isRecord(payload) && payload.all === true)
      return filter.unreadOnly
        ? []
        : items.map((item) => (item.readAt ? item : { ...item, readAt: now }));
    const read = parseNotificationItem(payload);
    if (!read || !items.some((item) => item.id === read.id)) return items;
    return filter.unreadOnly
      ? items.filter((item) => item.id !== read.id)
      : items.map((item) => (item.id === read.id ? { ...item, readAt: read.readAt ?? now } : item));
  }
  return items;
}

export function toChatMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  const { id, conversationId, senderId, content, createdAt } = value;
  if (
    typeof id !== 'string' ||
    typeof conversationId !== 'string' ||
    typeof senderId !== 'string' ||
    typeof content !== 'string'
  )
    return null;
  return {
    id,
    conversationId,
    senderId,
    content,
    createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
    ...(isRecord(value.listing) ? { listing: value.listing as ChatMessage['listing'] } : {}),
    ...(Array.isArray(value.attachments)
      ? { attachments: value.attachments as ChatMessage['attachments'] }
      : {}),
  };
}

// Applies chat:message to the conversation list: latest message, move to top, unread for incoming messages
// in conversations that are not open. `unknown` tells the caller to reload the list.
export function applyChatMessage(
  conversations: ChatConversation[],
  message: ChatMessage,
  context: { myId?: string; openId?: string | null }
) {
  const index = conversations.findIndex((item) => item.id === message.conversationId);
  if (index < 0) return { conversations, unknown: true, appendToOpen: false, markRead: false };
  const incoming = !!context.myId && message.senderId !== context.myId;
  const open = context.openId === message.conversationId;
  const current = conversations[index];
  const updated: ChatConversation = {
    ...current,
    lastMessage: message.content,
    lastMessageAt: message.createdAt,
    lastMessageSenderId: message.senderId,
    unreadCount: incoming && !open ? current.unreadCount + 1 : open ? 0 : current.unreadCount,
  };
  return {
    conversations: [updated, ...conversations.filter((_, i) => i !== index)],
    unknown: false,
    appendToOpen: open,
    markRead: incoming && open,
  };
}
