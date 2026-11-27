// Port of useLinkAction in hs-web-app components/branch/linkUi.tsx. The success message stays inline
// instead of a dialog, so a series of attachments needs no extra taps.
import { useEffect, useRef, useState } from 'react';

import { useDialogHost } from '@/components/AppDialog';
import { branchError } from '@/lib/branch-error';

const listeners = new Set<() => unknown>();

/**
 * The tray keeps its own read while mounted behind the map: a write in the room panel and the map's
 * pull to refresh ask it to read again.
 */
export const reloadTray = () => Promise.all([...listeners].map((listener) => listener()));

export function useTrayReload(reload: () => unknown) {
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    const listener = () => latest.current();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}

/** One link write at a time. Reloads afterwards either way: a 409 or a lost response means stale. */
export function useLinkAction(onDone: () => Promise<unknown>) {
  const host = useDialogHost();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async (action: () => Promise<void>, done: string) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    let ok = false;
    try {
      await action();
      ok = true;
      setSuccess(done);
    } catch (failure) {
      const reason = branchError(failure, 'Chưa thực hiện được.');
      if (mounted.current) setError(reason);
      // The sheet that wrote is gone, and its nested dialog host with it.
      else (host.root ?? host).show('Thông báo', reason, undefined, 'warning');
    }
    await onDone();
    running.current = false;
    if (mounted.current) setBusy(false);
    return ok;
  };

  const clear = () => {
    setError('');
    setSuccess('');
  };
  return { busy, error, success, run, clear };
}
