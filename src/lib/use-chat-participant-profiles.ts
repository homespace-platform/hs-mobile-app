import { useEffect, useState } from 'react';

import { subscribeChatEvents } from '@/lib/realtime/connections';
import { getChatParticipantProfile } from '@/services/chatApi';

type Profile = Awaited<ReturnType<typeof getChatParticipantProfile>>;

export function useChatParticipantProfiles(userIds: string[], refreshVersion = 0) {
  const key = JSON.stringify([...new Set(userIds)].sort());
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    const ids = new Set(JSON.parse(key) as string[]);
    const requests = new Map<string, Promise<Profile>>();
    function refresh(userId: string) {
      const request = getChatParticipantProfile(userId);
      requests.set(userId, request);
      void request.then((profile) => {
        if (requests.get(userId) === request) {
          setProfiles((current) => ({ ...current, [userId]: profile }));
        }
      }).catch(() => undefined);
    }
    setProfiles((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => ids.has(id)),
    ));
    const unsubscribe = subscribeChatEvents((event, payload) => {
      if (event === 'connect') ids.forEach(refresh);
      else if (event === 'chat:profile:changed') {
        const id = (payload as { userId?: unknown } | undefined)?.userId;
        if (typeof id === 'string' && ids.has(id)) refresh(id);
      }
    });
    ids.forEach(refresh);
    return () => {
      unsubscribe();
      requests.clear();
    };
  }, [key, refreshVersion]);

  return profiles;
}
