// Pure KYC helpers (no React Native imports, so node tests can load them).
// Contract shared with hs-web-app `/kyc?client=app&state=...`: the web page returns to
// `homespace://kyc/result?state=...&status=...`. `status` is only a hint; the backend decides.
import { bytesToBase64Url } from '@/lib/push/pure';

export const KYC_RESULT_REDIRECT = 'homespace://kyc/result';
/** A started KYC attempt is accepted back for this long. */
export const KYC_STATE_TTL_MS = 30 * 60 * 1000;

export const KYC_HINTS = [
  'VERIFIED',
  'REJECTED',
  'REVIEW_REQUIRED',
  'EXPIRED',
  'PENDING',
  'CANCELLED',
  'ERROR',
] as const;
export type KycHint = (typeof KYC_HINTS)[number];
/** Backend `GET /users/me/kyc` status (hs-web-app types/kyc.type.ts). */
export type KycBackendStatus =
  'NOT_VERIFIED' | 'PENDING' | 'REVIEW_REQUIRED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export type KycPending = { state: string; createdAt: number };
export type KycOutcome = { title: string; message: string; tone: 'success' | 'info' | 'danger' };

const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/;
export const isValidKycState = (value: unknown): value is string =>
  typeof value === 'string' && STATE_RE.test(value);

/** 24 random bytes -> 32 base64url chars, no padding. */
export function createKycState(randomBytes: (size: number) => ArrayLike<number>): string {
  return bytesToBase64Url(randomBytes(24));
}

/** Throws when the web origin is missing/not http(s) or the state is malformed (never builds a half URL). */
export function buildKycUrl(webBaseUrl: string | undefined | null, state: string): string {
  const base = (webBaseUrl ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s?#/][^\s?#]*$/i.test(base)) throw new Error('KYC_WEB_BASE_URL_INVALID');
  if (!isValidKycState(state)) throw new Error('KYC_STATE_INVALID');
  return `${base}/kyc?client=app&state=${encodeURIComponent(state)}`;
}

const RESULT_RE = /^homespace:\/\/kyc\/result(?:\?([^#]*))?(?:#.*)?$/i;

/**
 * Only `homespace://kyc/result?...` is accepted. Unknown/missing status -> ERROR; a missing, repeated,
 * malformed or over-long state -> null (the link is ignored).
 */
export function parseKycResultUrl(url: unknown): { state: string; status: KycHint } | null {
  if (typeof url !== 'string' || url.length > 2048) return null;
  const match = RESULT_RE.exec(url.trim());
  if (!match) return null;
  const values: Record<string, string[]> = { state: [], status: [] };
  for (const part of (match[1] ?? '').split('&')) {
    const eq = part.indexOf('=');
    const key = eq < 0 ? part : part.slice(0, eq);
    if (key !== 'state' && key !== 'status') continue;
    try {
      values[key].push(decodeURIComponent(eq < 0 ? '' : part.slice(eq + 1)));
    } catch {
      values[key].push('');
    }
  }
  if (values.state.length !== 1 || !isValidKycState(values.state[0])) return null;
  const status = values.status.length === 1 ? values.status[0] : '';
  return {
    state: values.state[0],
    status: (KYC_HINTS as readonly string[]).includes(status) ? (status as KycHint) : 'ERROR',
  };
}

const EXPIRED: KycOutcome = {
  title: 'Phiên xác minh đã hết hạn',
  message: 'Vui lòng bắt đầu xác minh lại.',
  tone: 'danger',
};

/** Backend status wins; the hint only refines the cases where the backend has no verdict yet. */
export function describeOutcome(
  backendStatus: string | null | undefined,
  hint: string | null | undefined,
  rejectionReason?: string | null
): KycOutcome {
  switch (backendStatus) {
    case 'VERIFIED':
      return {
        title: 'Danh tính đã được xác minh',
        message: 'Tài khoản của bạn đã xác minh danh tính thành công.',
        tone: 'success',
      };
    case 'REJECTED':
      return {
        title: 'Xác minh không thành công',
        message: rejectionReason?.trim() || 'Thông tin xác minh chưa hợp lệ. Vui lòng thử lại.',
        tone: 'danger',
      };
    case 'REVIEW_REQUIRED':
      return {
        title: 'Đang chờ xét duyệt',
        message: 'Hồ sơ của bạn đang được xem xét. Chúng tôi sẽ thông báo khi có kết quả.',
        tone: 'info',
      };
    case 'EXPIRED':
      return EXPIRED;
    case 'NOT_VERIFIED':
    case 'PENDING':
      if (hint === 'CANCELLED')
        return {
          title: 'Đã hủy xác minh',
          message: 'Bạn chưa hoàn tất xác minh danh tính. Bạn có thể thử lại bất cứ lúc nào.',
          tone: 'info',
        };
      if (hint === 'EXPIRED') return EXPIRED;
      if (hint === 'ERROR')
        return {
          title: 'Xác minh gặp lỗi',
          message: 'Đã có lỗi trong quá trình xác minh. Vui lòng thử lại.',
          tone: 'danger',
        };
      // The browser said "done" but this account has no result: most likely a different account was signed in there.
      if (hint === 'VERIFIED' || hint === 'REVIEW_REQUIRED')
        return {
          title: 'Chưa nhận được kết quả cho tài khoản này',
          message:
            'Trình duyệt báo đã gửi xác minh nhưng tài khoản trong ứng dụng chưa có kết quả. Có thể bạn đã đăng nhập tài khoản khác trên trình duyệt. Hãy thử lại bằng đúng tài khoản của ứng dụng.',
          tone: 'danger',
        };
      return backendStatus === 'PENDING'
        ? {
            title: 'Xác minh chưa hoàn tất',
            message: 'Phiên xác minh đang chờ xử lý. Vui lòng hoàn tất hoặc thử lại sau.',
            tone: 'info',
          }
        : {
            title: 'Chưa xác minh danh tính',
            message: 'Bạn chưa hoàn tất xác minh danh tính.',
            tone: 'info',
          };
    default:
      return {
        title: 'Chưa kiểm tra được kết quả',
        message:
          'Không thể kiểm tra trạng thái xác minh. Vui lòng xem lại trong Tài khoản và bảo mật.',
        tone: 'danger',
      };
  }
}

export const KYC_STATUS_LABELS: Record<KycBackendStatus, string> = {
  NOT_VERIFIED: 'Chưa xác minh',
  PENDING: 'Đang xác minh',
  REVIEW_REQUIRED: 'Đang chờ xét duyệt',
  VERIFIED: 'Đã xác minh',
  REJECTED: 'Xác minh không thành công',
  EXPIRED: 'Phiên xác minh đã hết hạn',
};

/** Stored attempt is well-formed, not from the future (clock change) and younger than the TTL. */
export function isPendingValid(record: unknown, now: number): record is KycPending {
  const r = record as Partial<KycPending> | null;
  return (
    !!r &&
    isValidKycState(r.state) &&
    typeof r.createdAt === 'number' &&
    Number.isFinite(r.createdAt) &&
    now >= r.createdAt &&
    now - r.createdAt < KYC_STATE_TTL_MS
  );
}
