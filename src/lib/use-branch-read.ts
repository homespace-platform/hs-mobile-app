// Ports of hs-web-app hooks/useRefetchOnReturn.ts and useNowMs.ts. On the phone "returning" is either
// a remount (back from a destination screen) or the app coming to the foreground.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Reads on mount, whenever `load` changes and when the app becomes active again. Late answers are
 * dropped; a failed refresh keeps the last answer of the same `load`. Both arguments must be stable.
 */
export function useBranchRead<T>(load: () => Promise<T>, describe: (error: unknown) => string) {
  const [result, setResult] = useState<{
    load: () => Promise<T>;
    data: T | null;
    error: string;
    at: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // A write may finish after `load` changed and still hold the old `reload`: read what is shown now.
  const latest = useRef(load);
  latest.current = load;

  // `load` stays a dependency so that a new one gets a new `reload`, which runs the effect again.
  const reload = useCallback(async () => {
    const read = latest.current;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const data = await read();
      if (mine !== seq.current) return;
      setResult({ load: read, data, error: '', at: Date.now() });
    } catch (failure) {
      if (mine !== seq.current) return;
      const error = describe(failure);
      setResult((old) => ({
        load: read,
        data: old?.load === read ? old.data : null,
        error,
        at: old?.at ?? 0,
      }));
    }
    setLoading(false);
  }, [load, describe]);

  useEffect(() => {
    void reload();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => {
      seq.current++;
      subscription.remove();
    };
  }, [reload]);

  const current = result?.load === load ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? '',
    /** When `data` arrived; countdowns add the time passed since then to the server's clock. */
    at: current?.at ?? 0,
    loading,
    reload,
  };
}

/** Device clock that re-renders every `intervalMs`; a hint only, the server decides deadlines. */
export function useNowMs(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
