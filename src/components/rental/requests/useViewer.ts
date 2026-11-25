// Web useAuth().userId: read from the signed-in session, so no profile or other API can block it.
import { useCallback, useEffect, useState } from 'react';

import { getAccessToken } from '@/features/auth/session';

import { tokenSubject } from './logic';

export function useViewer() {
  const [userId, setUserId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void getAccessToken().then((token) => {
      if (!active) return;
      const subject = tokenSubject(token);
      setUserId(subject);
      setFailed(!subject);
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { userId, failed, retry };
}
