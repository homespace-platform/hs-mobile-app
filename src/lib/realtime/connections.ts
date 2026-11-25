import { useEffect } from 'react';
import { AppState } from 'react-native';

import { gatewayBaseUrl, realtimeOrigin } from '@/config/env';
import { chatPresenceStore, type ChatPresenceUpdate } from '@/lib/chat-presence';
import { createPresenceSync } from '@/lib/realtime/presence-sync';
import { gatewaySocketTarget, normalizeOrigin } from '@/lib/realtime/pure';
import {
  createManagedSocket,
  type EmitResult,
  type SocketListener,
} from '@/lib/realtime/socket-manager';
import { notificationUnreadStore } from '@/lib/unread-store';
import {
  refreshChatUnread,
  refreshNotificationUnread,
  resetUnreadCounts,
  scheduleNotificationUnreadRefresh,
} from '@/lib/unread-sync';

// Notifications: Gateway route /api/v1/notifications/socket.io, namespace /notifications, JWT in handshake.auth.token.
// The service checks the Origin header against NOTIFICATION_REALTIME_ORIGINS and RN sends none, so we send the
// app's own EXPO_PUBLIC_REALTIME_ORIGIN; without it this socket stays off and push + REST keep working.
const notificationTarget = gatewaySocketTarget(gatewayBaseUrl, 'notifications');
const origin = normalizeOrigin(realtimeOrigin);
const notificationSocket =
  notificationTarget && origin
    ? createManagedSocket({
        url: `${notificationTarget.origin}/notifications`,
        path: notificationTarget.path,
        tokenInAuth: true,
        headers: () => ({ Origin: origin }),
      })
    : null;

// Chat: same socket the web app uses through the Gateway (default namespace, Bearer header on the upgrade).
const chatTarget = gatewaySocketTarget(gatewayBaseUrl, 'chat');
const chatSocket = chatTarget
  ? createManagedSocket({
      url: chatTarget.origin,
      path: chatTarget.path,
      // Like the web app: start with long-polling (Gateway authenticates the Bearer header on every request),
      // then upgrade when the Gateway lets a WebSocket through. A WebSocket-only connection was refused.
      transports: ['polling', 'websocket'],
      headers: (token) => ({ Authorization: `Bearer ${token}` }),
    })
  : null;

export function emitChatWithAck(
  event: string,
  payload: unknown,
  timeoutMs?: number
): Promise<EmitResult> {
  return chatSocket?.emitWithAck(event, payload, timeoutMs) ?? Promise.resolve({ ok: false });
}

const presenceSync = createPresenceSync({
  emitWithAck: emitChatWithAck,
  isConnected: () => chatSocket?.isConnected() ?? false,
  apply: chatPresenceStore.apply,
});
// Ask for the presence of these users (the server only answers for people sharing a conversation with us).
export const watchChatPresence = presenceSync.watch;
function resetChatPresence() {
  presenceSync.reset();
  chatPresenceStore.clear();
}

const notificationListeners = new Set<SocketListener>();

function dispatchNotificationEvent(event: string, payload?: unknown) {
  if (event === 'notification:unread-count') {
    const count = (payload as { count?: unknown } | undefined)?.count;
    if (typeof count === 'number') notificationUnreadStore.dispatch({ type: 'set', count });
  } else if (
    event === 'connect' ||
    event === 'notifications:changed' ||
    event.startsWith('notification:')
  ) {
    scheduleNotificationUnreadRefresh();
  }
  notificationListeners.forEach((listener) => listener(event, payload));
}
notificationSocket?.subscribe(dispatchNotificationEvent);
chatSocket?.subscribe((event, payload) => {
  if (event === 'connect') presenceSync.onConnect();
  else if (event === 'chat:presence') chatPresenceStore.apply([payload as ChatPresenceUpdate]);
  // Badge on the Messages tab; the delay lets an open conversation mark itself read first.
  if (event === 'chat:message' || event === 'connect')
    setTimeout(() => void refreshChatUnread(), 1000);
});

// Events: connect, notification:new|read|deleted|unread-count, plus notifications:changed (push received).
export function subscribeNotificationEvents(listener: SocketListener) {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

// Events: connect, chat:message, chat:message:updated, chat:message:deleted, ...
const chatLocalListeners = new Set<SocketListener>();
export function subscribeChatEvents(listener: SocketListener) {
  const off = chatSocket?.subscribe(listener);
  chatLocalListeners.add(listener);
  return () => {
    off?.();
    chatLocalListeners.delete(listener);
  };
}

// A chat push arrived while the app is open: screens refresh from REST even if the chat socket is down.
export const notifyChatChanged = () =>
  chatLocalListeners.forEach((listener) => listener('chat:refresh'));
export const isChatSocketConnected = () => chatSocket?.isConnected() ?? false;

// A foreground push arrived: same effect as a socket event, so it also works without the socket.
export const notifyNotificationsChanged = () => dispatchNotificationEvent('notifications:changed');

// Mounted once while signed in: connects sockets in the foreground, drops them in the background
// (push covers that time) and on sign-out/unmount.
export function useRealtimeConnections() {
  useEffect(() => {
    const start = () => {
      notificationSocket?.start();
      chatSocket?.start();
      void refreshNotificationUnread();
      void refreshChatUnread();
    };
    const stop = () => {
      notificationSocket?.stop();
      chatSocket?.stop();
      resetChatPresence();
    };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        start();
        notifyNotificationsChanged();
      } else if (state === 'background') stop();
    });
    return () => {
      subscription.remove();
      stop();
      resetUnreadCounts();
    };
  }, []);
}
