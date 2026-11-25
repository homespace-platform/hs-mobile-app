// hs-web-app components/rental-request/useRentalRequestDeepLink.ts. The URL parameter is the route's
// `requestId`; "strip the parameter" is `clearParam` (a replace navigation).
import { useCallback, useEffect, useRef } from 'react';

import { useDialog } from '@/components/AppDialog';
import { DEEP_LINK_INVALID } from '@/lib/rental/useRentalRequestDeepLink';
import rentalRequestService from '@/services/rental/rental-request.service';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { resolveDeepLink, type Mode } from './logic';

export function useRentalRequestDeepLink(options: {
  requestId?: string;
  invalidLink?: boolean;
  userId: string | null;
  mode: Mode;
  onOpen: (request: RentalRequestResponse | null) => void;
  clearParam: () => void;
}) {
  const { requestId, invalidLink, userId, mode } = options;
  const showDialog = useDialog();
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const linkActive = useRef(false);

  const strip = useCallback(() => {
    const { requestId, invalidLink, clearParam } = latest.current;
    if (requestId || invalidLink) clearParam();
  }, []);

  useEffect(() => {
    if (!invalidLink) return;
    showDialog('Thông báo', DEEP_LINK_INVALID);
    strip();
  }, [invalidLink, showDialog, strip]);

  useEffect(() => {
    if (!requestId) {
      // The parameter went away while the link was open: close what it opened.
      if (linkActive.current) {
        linkActive.current = false;
        latest.current.onOpen(null);
      }
      return;
    }
    if (!userId) return;
    let disposed = false;
    linkActive.current = true;
    latest.current.onOpen(null);
    void resolveDeepLink(requestId, mode, userId, (id) =>
      rentalRequestService.getRequestById(id)
    ).then((result) => {
      if (disposed) return;
      if ('request' in result) return latest.current.onOpen(result.request);
      linkActive.current = false;
      showDialog('Thông báo', result.notice);
      strip();
    });
    return () => {
      disposed = true;
    };
  }, [requestId, userId, mode, showDialog, strip]);

  return useCallback(() => {
    linkActive.current = false;
    strip();
  }, [strip]);
}
