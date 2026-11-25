import { useSyncExternalStore } from 'react';

import { chatUnreadStore, notificationUnreadStore, type UnreadStore } from '@/lib/unread-store';

const useStore = (store: UnreadStore) =>
  useSyncExternalStore(store.subscribe, store.get, store.get);

export const useUnreadNotificationCount = () => useStore(notificationUnreadStore);
export const useUnreadChatCount = () => useStore(chatUnreadStore);
