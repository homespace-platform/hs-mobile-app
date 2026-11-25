import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  bytesToBase64Url,
  isValidFcmToken,
  isValidIdentity,
  PUSH_CHANNEL_ID,
  uuidV4FromBytes,
  type PushIdentity,
} from '@/lib/push/pure';
import { deletePushDevice, putPushDevice } from '@/services/pushDeviceApi';

// Android only. iOS getDevicePushTokenAsync returns an APNs token, but the server sends through FCM;
// iOS needs @react-native-firebase/messaging (or equivalent) to obtain an FCM token in a later phase.
export const pushSupported = () => Platform.OS === 'android';
// Emulators report isDevice=false; they still work when the image has Google Play services.
export const isPhysicalDevice = Device.isDevice;

const IDENTITY_KEY = 'homespace.push.identity';
const OPT_OUT_KEY = 'homespace.push.optOut';
const ASKED_KEY = 'homespace.push.permissionAsked';

export type PushPermission = 'granted' | 'denied' | 'undetermined';
export type PushResult = 'registered' | 'unsupported' | 'opted-out' | PushPermission | 'error';
export type PushStatus = {
  supported: boolean;
  permission: PushPermission;
  optedOut: boolean;
  registered: boolean;
};

let registered = false;
let memoryIdentity: PushIdentity | null = null;

const readFlag = async (key: string) => {
  try {
    return (await SecureStore.getItemAsync(key)) === '1';
  } catch {
    return false;
  }
};
const writeFlag = async (key: string, on: boolean) => {
  try {
    if (on) await SecureStore.setItemAsync(key, '1');
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // Preference is best effort; the in-session behavior still follows the user's action.
  }
};

async function readIdentity(): Promise<PushIdentity | null> {
  if (memoryIdentity) return memoryIdentity;
  try {
    const parsed: unknown = JSON.parse((await SecureStore.getItemAsync(IDENTITY_KEY)) ?? 'null');
    if (isValidIdentity(parsed)) return (memoryIdentity = parsed);
  } catch {
    // Missing or corrupt: callers create a new identity.
  }
  return null;
}

// Created once per installation and kept only on this device; never logged or sent elsewhere.
async function getOrCreateIdentity(): Promise<PushIdentity> {
  const existing = await readIdentity();
  if (existing) return existing;
  const identity = {
    installationId: uuidV4FromBytes(Crypto.getRandomBytes(16)),
    installationSecret: bytesToBase64Url(Crypto.getRandomBytes(32)),
  };
  memoryIdentity = identity;
  try {
    await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Without SecureStore the identity lives for this process only.
  }
  return identity;
}

export async function readPushPermission(): Promise<PushPermission> {
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted
    ? 'granted'
    : permission.status === Notifications.PermissionStatus.UNDETERMINED
      ? 'undetermined'
      : 'denied';
}

export async function ensurePermission(askIfUndetermined = true): Promise<PushPermission> {
  const current = await readPushPermission();
  if (current === 'granted' || !askIfUndetermined) return current;
  await writeFlag(ASKED_KEY, true);
  await Notifications.requestPermissionsAsync();
  return readPushPermission();
}

// Must be named exactly like the channel the server targets; created before the permission prompt (Android 13+).
async function ensureAndroidChannel() {
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: 'Thông báo HomeSpace',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

let queue: Promise<unknown> = Promise.resolve();
const serialize = <T>(task: () => Promise<T>) => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};

// options.prompt: ask for permission once automatically (first sign-in). options.userInitiated: explicit
// "Bật" press; clears the opt-out and asks even if the automatic prompt was already used.
export function registerPushDevice(
  options: { prompt?: boolean; userInitiated?: boolean } = {}
): Promise<PushResult> {
  return serialize(async () => {
    try {
      if (!pushSupported()) return 'unsupported';
      if (options.userInitiated) await writeFlag(OPT_OUT_KEY, false);
      else if (await readFlag(OPT_OUT_KEY)) return 'opted-out';
      await ensureAndroidChannel();
      const askedBefore = await readFlag(ASKED_KEY);
      const permission = await ensurePermission(
        !!options.userInitiated || (!!options.prompt && !askedBefore)
      );
      if (permission !== 'granted') return permission;
      const token = await Notifications.getDevicePushTokenAsync();
      if (token.type !== 'android' || !isValidFcmToken(token.data)) return 'unsupported';
      await putPushDevice(await getOrCreateIdentity(), 'android', token.data);
      registered = true;
      return 'registered';
    } catch {
      // Missing google-services.json / Play services / network must never crash the app.
      return 'error';
    }
  });
}

// Logout calls this with the default (keeps the preference); the settings "Tắt" button passes optOut.
export async function unregisterPushDevice(options: { optOut?: boolean; timeoutMs?: number } = {}) {
  if (options.optOut) await writeFlag(OPT_OUT_KEY, true);
  if (!pushSupported()) return;
  const timeoutMs = options.timeoutMs ?? 3000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = (async () => {
      const identity = await readIdentity();
      if (identity) await deletePushDevice(identity, timeoutMs);
    })();
    await Promise.race([
      request,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } catch {
    // Failure is ignored on purpose: logout must not depend on the network.
  } finally {
    clearTimeout(timer);
    registered = false;
  }
}

// Re-registers when FCM rotates the token. Returns the unsubscribe function.
export function watchPushToken() {
  if (!pushSupported()) return () => undefined;
  const subscription = Notifications.addPushTokenListener(() => void registerPushDevice());
  return () => subscription.remove();
}

export async function getPushStatus(): Promise<PushStatus> {
  return {
    supported: pushSupported(),
    permission: pushSupported()
      ? await readPushPermission().catch(() => 'denied' as const)
      : 'denied',
    optedOut: await readFlag(OPT_OUT_KEY),
    registered,
  };
}
