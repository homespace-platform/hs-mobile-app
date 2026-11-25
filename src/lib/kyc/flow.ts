// KYC orchestration, dependency-injected so node tests can drive it. The web page `/kyc` does the eKYC;
// the app only starts it (one-use `state`), then asks the backend what happened.
import {
  KYC_RESULT_REDIRECT,
  buildKycUrl,
  createKycState,
  describeOutcome,
  isPendingValid,
  parseKycResultUrl,
  type KycHint,
  type KycOutcome,
  type KycPending,
} from '@/lib/kyc/pure';

export type KycBrowserResult = { type: string; url?: string };
export type KycStorage = {
  get: () => Promise<string | null>;
  set: (value: string) => Promise<void>;
  remove: () => Promise<void>;
};
export type KycFlowDeps = {
  openBrowser: (url: string, redirectUrl: string) => Promise<KycBrowserResult>;
  getStatus: () => Promise<{ status?: string | null; rejectionReason?: string | null }>;
  storage: KycStorage;
  now: () => number;
  /** Reload server-side onboarding (and anything else that depends on KYC); must not throw. */
  refresh: () => Promise<unknown>;
  randomBytes: (size: number) => ArrayLike<number>;
  getWebBaseUrl: () => string | undefined;
  /** Shows an outcome to the user (dialog). Never receives state/tokens. */
  report: (outcome: KycOutcome) => void;
};
export type KycStartResult = 'done' | 'busy' | 'not-configured' | 'open-failed';

const NOT_CONFIGURED: KycOutcome = {
  title: 'Chưa cấu hình xác minh',
  message: 'Ứng dụng chưa có địa chỉ trang web xác minh danh tính. Vui lòng liên hệ hỗ trợ.',
  tone: 'danger',
};
const OPEN_FAILED: KycOutcome = {
  title: 'Không mở được trang xác minh',
  message: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
  tone: 'danger',
};

export function createKycFlow(deps: KycFlowDeps) {
  // `pending` is the one attempt that may still come back. `loaded` = memory is authoritative (no storage read).
  let pending: KycPending | null = null;
  let loaded = false;
  let busy = false;
  let chain: Promise<unknown> = Promise.resolve();
  const busyListeners = new Set<() => void>();
  const finishedListeners = new Set<() => void>();

  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task);
    chain = run.catch(() => undefined);
    return run;
  };
  const setBusy = (next: boolean) => {
    busy = next;
    busyListeners.forEach((listener) => listener());
  };
  const clearStored = async () => {
    try {
      await deps.storage.remove();
    } catch {
      // Memory is cleared anyway, so this process cannot reuse the state.
    }
  };
  const readStored = async (): Promise<KycPending | null> => {
    try {
      const parsed: unknown = JSON.parse((await deps.storage.get()) ?? 'null');
      return isPendingValid(parsed, deps.now()) ? parsed : null;
    } catch {
      return null;
    }
  };

  /** Spends `state` once: true only if it is the live, unexpired attempt. A wrong state never burns the real one. */
  const consume = (state: string) =>
    serial(async () => {
      if (!loaded) {
        pending = await readStored();
        loaded = true;
      }
      if (pending && !isPendingValid(pending, deps.now())) {
        pending = null;
        await clearStored();
        return false;
      }
      if (!pending || pending.state !== state) return false;
      pending = null;
      await clearStored();
      return true;
    });

  const settle = async (hint: KycHint) => {
    let outcome: KycOutcome;
    try {
      const result = await deps.getStatus();
      outcome = describeOutcome(result?.status, hint, result?.rejectionReason);
    } catch {
      outcome = describeOutcome(null, hint);
    }
    try {
      await deps.refresh();
    } catch {
      // Refresh is best effort.
    }
    deps.report(outcome);
    finishedListeners.forEach((listener) => listener());
  };

  /** `homespace://kyc/result?...` from the browser session or from Linking (cold start); safe to call twice. */
  async function handleKycResultUrl(url: string): Promise<boolean> {
    const parsed = parseKycResultUrl(url);
    if (!parsed || !(await consume(parsed.state))) return false;
    await settle(parsed.status);
    return true;
  }

  /** Browser closed: a redirect URL is handled as a link, anything else (cancel/dismiss) counts as CANCELLED. */
  async function finishAfterBrowser(result: KycBrowserResult | null, state: string) {
    if (result?.type === 'success' && result.url) {
      await handleKycResultUrl(result.url);
      return;
    }
    // If the link already arrived through Linking, the state is spent and this stays silent.
    if (await consume(state)) await settle('CANCELLED');
  }

  async function startKyc(): Promise<KycStartResult> {
    if (busy) return 'busy';
    setBusy(true);
    try {
      const state = createKycState(deps.randomBytes);
      let url: string;
      try {
        url = buildKycUrl(deps.getWebBaseUrl(), state);
      } catch {
        deps.report(NOT_CONFIGURED);
        return 'not-configured';
      }
      const record: KycPending = { state, createdAt: deps.now() };
      await serial(async () => {
        pending = record; // replaces any older attempt, which can no longer come back
        loaded = true;
        try {
          await deps.storage.set(JSON.stringify(record));
        } catch {
          // SecureStore unavailable: the attempt lives in memory only (no cold-start recovery).
        }
      });
      let result: KycBrowserResult | null = null;
      try {
        result = await deps.openBrowser(url, KYC_RESULT_REDIRECT);
      } catch {
        if (await consume(state)) deps.report(OPEN_FAILED);
        return 'open-failed';
      }
      await finishAfterBrowser(result, state);
      return 'done';
    } finally {
      setBusy(false);
    }
  }

  return {
    startKyc,
    handleKycResultUrl,
    finishAfterBrowser,
    isBusy: () => busy,
    subscribeBusy(listener: () => void) {
      busyListeners.add(listener);
      return () => {
        busyListeners.delete(listener);
      };
    },
    /** Fires after every settled outcome so screens can reload the profile. */
    subscribeFinished(listener: () => void) {
      finishedListeners.add(listener);
      return () => {
        finishedListeners.delete(listener);
      };
    },
  };
}
