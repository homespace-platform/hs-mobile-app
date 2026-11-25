import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { chatPresenceStore, type ChatPresenceMap } from '@/lib/chat-presence';
import { watchChatPresence } from '@/lib/realtime/connections';

// Presence of the given users (unknown users are simply missing from the map = offline).
export function useChatPresence(userIds: string[]): ChatPresenceMap {
  const key = useMemo(() => JSON.stringify([...new Set(userIds)].sort()), [userIds]);
  useEffect(() => watchChatPresence(JSON.parse(key) as string[]), [key]);
  return useSyncExternalStore(chatPresenceStore.subscribe, chatPresenceStore.get);
}

// Re-renders every minute so "Hoạt động N phút trước" does not stand still.
export function useMinuteClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
