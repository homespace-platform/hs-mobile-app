import { useEffect } from 'react';
import { Linking } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import { handleKycResultUrl, setKycReporter } from '@/lib/kyc/client';

/** Mount once while signed in: shows KYC outcomes and receives `homespace://kyc/result` at any time, incl. cold start. */
export function useKycDeepLink() {
  const showDialog = useDialog();
  useEffect(() => {
    setKycReporter((outcome) =>
      showDialog(
        outcome.title,
        outcome.message,
        undefined,
        outcome.tone === 'success' ? 'success' : 'info'
      )
    );
    const subscription = Linking.addEventListener('url', ({ url }) => void handleKycResultUrl(url));
    // Idempotent: the same launch URL (or one already handled via the browser session) is ignored.
    Linking.getInitialURL()
      .then((url) => (url ? handleKycResultUrl(url) : undefined))
      .catch(() => undefined);
    return () => {
      subscription.remove();
      setKycReporter(undefined);
    };
  }, [showDialog]);
}
