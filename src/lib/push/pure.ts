// Pure helpers for device push registration (no React Native imports, so node tests can load them).
export const PUSH_CHANNEL_ID = 'homespace-notifications';

export type PushPlatform = 'android' | 'ios';
export type PushIdentity = { installationId: string; installationSecret: string };
export type PushRoute = 'messages' | 'notifications';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
// FCM registration tokens are ~160 chars of [A-Za-z0-9_-] with a ':' separator; APNs tokens are hex.
const FCM_TOKEN = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]{20,}$/;

export const isValidFcmToken = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 4096 && FCM_TOKEN.test(value);

export const isValidIdentity = (value: unknown): value is PushIdentity => {
  const v = value as Partial<PushIdentity> | null;
  return (
    !!v &&
    typeof v.installationId === 'string' &&
    UUID_V4.test(v.installationId) &&
    typeof v.installationSecret === 'string' &&
    SECRET.test(v.installationSecret)
  );
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// base64url without padding (32 bytes -> 43 chars).
export function bytesToBase64Url(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

// RFC 4122 v4 from 16 random bytes.
export function uuidV4FromBytes(bytes: ArrayLike<number>): string {
  const b = Array.from(bytes).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const buildRegisterBody = (identity: PushIdentity, platform: PushPlatform, fid: string) => ({
  installationId: identity.installationId,
  installationSecret: identity.installationSecret,
  platform,
  fid,
});

export const buildUnregisterBody = (identity: PushIdentity) => ({
  installationSecret: identity.installationSecret,
});

// Notification data lives in content.data; on Android a system-displayed FCM message can carry it in remoteMessage.data.
export function pushDataFromRequest(request: unknown): unknown {
  const r = request as {
    content?: { data?: Record<string, unknown> };
    trigger?: { remoteMessage?: { data?: Record<string, unknown> } };
  } | null;
  const data = r?.content?.data;
  return data && 'event' in data ? data : (r?.trigger?.remoteMessage?.data ?? data);
}

// Push data: { event: 'notifications.changed', category }. CHAT opens the Messages tab, the rest the notification center.
export function pushRouteFromData(data: unknown): PushRoute | null {
  const d = data as { event?: unknown; category?: unknown } | null;
  if (!d || d.event !== 'notifications.changed') return null;
  return d.category === 'CHAT' ? 'messages' : 'notifications';
}
