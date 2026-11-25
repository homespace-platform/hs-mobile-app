import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';

import { webBaseUrl } from '@/config/env';
import { authBrowserOptions } from '@/lib/auth/discovery';
import { createKycFlow } from '@/lib/kyc/flow';
import type { KycOutcome } from '@/lib/kyc/pure';
import { refreshOnboarding } from '@/lib/onboarding-store';
import { getKycStatus } from '@/services/kycApi';

/**
 * How the web `/kyc` page is shown. true = auth session (Custom Tab / ASWebAuthenticationSession, closes itself on
 * the homespace://kyc/result redirect). false = plain browser (the result comes back only through Linking).
 * Camera inside the iOS embedded browser is NOT verified: if it fails on a real iPhone, flip this one constant.
 */
const USE_AUTH_SESSION = true;

const STORAGE_KEY = 'homespace.kyc.pending';
let reporter: ((outcome: KycOutcome) => void) | undefined;
export const setKycReporter = (next: typeof reporter) => {
  reporter = next;
};

const flow = createKycFlow({
  openBrowser: (url, redirectUrl) =>
    USE_AUTH_SESSION
      ? WebBrowser.openAuthSessionAsync(url, redirectUrl, authBrowserOptions)
      : WebBrowser.openBrowserAsync(url, authBrowserOptions),
  getStatus: getKycStatus,
  storage: {
    get: () => SecureStore.getItemAsync(STORAGE_KEY),
    set: (value) => SecureStore.setItemAsync(STORAGE_KEY, value),
    remove: () => SecureStore.deleteItemAsync(STORAGE_KEY),
  },
  now: Date.now,
  refresh: refreshOnboarding,
  randomBytes: (size) => Crypto.getRandomBytes(size),
  getWebBaseUrl: () => webBaseUrl,
  report: (outcome) => reporter?.(outcome),
});

export const startKyc = flow.startKyc;
export const handleKycResultUrl = flow.handleKycResultUrl;
export const subscribeKycFinished = flow.subscribeFinished;
/** True while a KYC browser session is open: lock the start buttons. */
export const useKycBusy = () => useSyncExternalStore(flow.subscribeBusy, flow.isBusy, flow.isBusy);
