import { chatPresenceStore } from '@/lib/chat-presence';
import { chatUnreadStore, notificationUnreadStore } from '@/lib/unread-store';
import { listConversations } from '@/services/chatApi';
import { getUnreadNotificationCount } from '@/services/notificationApi';

let notificationInFlight: Promise<void> | null = null;
let notificationFetchedAt = 0;
let notificationTimer: ReturnType<typeof setTimeout> | undefined;
let chatInFlight: Promise<void> | null = null;
let chatFetchedAt = 0;

// Failures keep the last known count; the next event/foreground refresh retries.
export function refreshNotificationUnread(maxAgeMs = 0) {
  if (notificationInFlight) return notificationInFlight;
  if (maxAgeMs > 0 && Date.now() - notificationFetchedAt < maxAgeMs) return Promise.resolve();
  notificationInFlight = getUnreadNotificationCount()
    .then((count) => {
      notificationFetchedAt = Date.now();
      notificationUnreadStore.dispatch({ type: 'set', count });
    })
    .catch(() => undefined)
    .finally(() => {
      notificationInFlight = null;
    });
  return notificationInFlight;
}

// Coalesces bursts of socket/push events into one request.
export function scheduleNotificationUnreadRefresh(delayMs = 150) {
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => void refreshNotificationUnread(), delayMs);
}

// One conversations request sums the unread messages; maxAgeMs avoids a request per tab switch.
export function refreshChatUnread(maxAgeMs = 0) {
  if (chatInFlight) return chatInFlight;
  if (maxAgeMs > 0 && Date.now() - chatFetchedAt < maxAgeMs) return Promise.resolve();
  chatInFlight = listConversations()
    .then((items) => {
      chatFetchedAt = Date.now();
      chatUnreadStore.dispatch({
        type: 'set',
        count: items.reduce((total, item) => total + (item.unreadCount || 0), 0),
      });
    })
    .catch(() => undefined)
    .finally(() => {
      chatInFlight = null;
    });
  return chatInFlight;
}

export function resetUnreadCounts() {
  clearTimeout(notificationTimer);
  notificationFetchedAt = 0;
  chatFetchedAt = 0;
  notificationUnreadStore.dispatch({ type: 'reset' });
  chatUnreadStore.dispatch({ type: 'reset' });
  chatPresenceStore.clear();
}
