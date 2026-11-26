// Editor session, catalog, payload parameters and save flow of hs-web-app ListingEditor.tsx.
// Network calls are injected; services/listingEditorApi.ts wires the real ones.
import { isAxiosError } from 'axios';

import {
  categoryCode,
  type ListingEditorMode,
  type ListingFormState,
  type ListingNotice,
  type MonthlyExpensesData,
} from '@/lib/listing-form';
import { mapListingDetailToFormState } from '@/lib/listing-form-map';
import { uploadListingMedia, type ListingMediaKind } from '@/lib/listing-media';
import {
  buildCreateListingPayload,
  type BuildPayloadParams,
  type ListingChargeRequest,
  type ListingPayload,
  type UploadedListingMedia,
} from '@/lib/listing-payload';
import { policyInputs, withDefaultSuggestions, withSystemRules } from '@/lib/listing-policy';
import { isListingQuotaExhaustedError, QUOTA_EXHAUSTED_MESSAGE } from '@/lib/listing-quota';
import { validateListing, type ValidationResult } from '@/lib/listing-validation';
import type { Branch } from '@/services/branchApi';
import type { ListingDetail } from '@/services/listingApi';
import type { ListingCatalog, ListingSubmissionAction } from '@/services/listingCreateApi';
import type { LocalFile } from '@/services/storageApi';
import type { UserAddress } from '@/types/api';

/** Everything about the editor that is not user input. Do not change it while editing. */
export type ListingEditorSession = {
  mode: ListingEditorMode;
  /** Edited listing (edit) or source listing (duplicate). */
  listingId: string | null;
  sourceTitle: string;
  status: string | null;
  pendingEdit: boolean;
  /** Why the admin refused the last edit, when the API says so. */
  editRejectionReason: string | null;
  /** Edit only: this date stays valid while unchanged, even when past. */
  originalAvailableDate: string | null;
  vehicleLimits: { maxMotorbikeCount: number | null; maxCarCount: number | null } | null;
  chargeBaseline: { charges: ListingChargeRequest[]; expenses: MonthlyExpensesData } | null;
};

export const createListingSession = (): ListingEditorSession => ({
  mode: 'create',
  listingId: null,
  sourceTitle: '',
  status: null,
  pendingEdit: false,
  editRejectionReason: null,
  originalAvailableDate: null,
  vehicleLimits: null,
  chargeBaseline: null,
});

export function openListing(
  detail: ListingDetail,
  mode: 'edit' | 'duplicate',
  branches: Branch[],
  today: string
): { state: ListingFormState; session: ListingEditorSession; notice?: ListingNotice } {
  if (!['APARTMENT', 'HOUSE', 'ROOM'].includes(detail.category))
    throw new Error('Loại tin này chưa có biểu mẫu chỉnh sửa trên mobile.');
  const { state, notice } = mapListingDetailToFormState(detail, mode, branches, today);
  return {
    state,
    notice,
    session: {
      mode,
      listingId: detail.id,
      sourceTitle: mode === 'duplicate' ? detail.title || 'Tin gốc' : '',
      status: detail.status,
      pendingEdit: Boolean(detail.pendingEditId),
      editRejectionReason: mode === 'edit' ? detail.editRejectionReason || null : null,
      originalAvailableDate: mode === 'edit' ? detail.availableFrom : null,
      vehicleLimits: {
        maxMotorbikeCount: detail.maxMotorbikeCount ?? null,
        maxCarCount: detail.maxCarCount ?? null,
      },
      chargeBaseline: { charges: detail.charges ?? [], expenses: state.monthlyExpenses },
    },
  };
}

export const MISSING_EDIT_ID_ERROR = 'Không tìm thấy tin đăng cần chỉnh sửa.';
export const loadErrorMessage = (mode: ListingEditorMode) =>
  mode === 'duplicate'
    ? 'Không thể nhân bản tin đăng này. Tin đăng không tồn tại hoặc bạn không có quyền sở hữu.'
    : 'Không tìm thấy tin đăng hoặc bạn không có quyền chỉnh sửa.';

const normalize = (status?: string | null) =>
  String(status || '')
    .trim()
    .toUpperCase();

/** Non-null: replace the whole form with this lock screen (offer "Nhân bản thành tin mới"). */
export function listingLock(session: ListingEditorSession, title: string) {
  if (session.mode !== 'edit' || normalize(session.status) !== 'RENTED_EXTERNALLY') return null;
  return {
    title: 'Tin đăng đã cho thuê ngoài hệ thống',
    message: `Tin đăng "${title || 'Tin đăng'}" đã được đánh dấu là cho thuê ngoài hệ thống nên không thể chỉnh sửa nội dung, lưu nháp hoặc gửi duyệt lại.`,
  };
}

/** True: hide "Lưu nháp"; the change becomes a pending edit for the admin. */
export const requiresEditReview = (session: ListingEditorSession) =>
  session.mode === 'edit' &&
  (session.pendingEdit ||
    ['PUBLISHED', 'RESERVED', 'RENTED', 'HIDDEN', 'EXPIRED'].includes(String(session.status)));

export const EDIT_SUBMIT_CONFIRM = {
  title: 'Xác nhận gửi?',
  description: 'Đây là nội dung sau khi chỉnh sửa; thay đổi chỉ có hiệu lực sau khi bạn lưu.',
  confirmLabel: 'Xác nhận gửi',
  cancelLabel: 'Quay lại chỉnh sửa',
};

const REPLACE_PENDING_CONFIRM = {
  title: 'Thay thế bản sửa đang chờ duyệt?',
  description:
    'Bản gửi mới thay thế toàn bộ bản sửa đang chờ duyệt. Biểu mẫu đang hiển thị nội dung đã được duyệt, nên những thay đổi chỉ có trong bản đang chờ sẽ mất.',
  confirmLabel: 'Thay thế và gửi duyệt',
  cancelLabel: 'Quay lại chỉnh sửa',
  tone: 'warning' as const,
};

export const editSubmitConfirm = (session: ListingEditorSession) =>
  session.pendingEdit ? REPLACE_PENDING_CONFIRM : EDIT_SUBMIT_CONFIRM;

/** Read right before an edit is sent: a pending edit may have appeared since the form opened. */
export async function refreshEditSession(
  session: ListingEditorSession,
  read: (id: string) => Promise<ListingDetail>
): Promise<ListingEditorSession> {
  const detail = await read(session.listingId!);
  return {
    ...session,
    status: detail.status,
    pendingEdit: Boolean(detail.pendingEditId),
    editRejectionReason: detail.editRejectionReason || null,
  };
}

/** The save the quota dialog may offer: a listing under edit review cannot be saved as a draft. */
export const quotaSaveAction = (session: ListingEditorSession): ListingSubmissionAction =>
  requiresEditReview(session) ? 'SUBMIT_FOR_REVIEW' : 'SAVE_DRAFT';

/** The purchase chosen on the way to the membership screen. */
export type QuotaPurchase = 'plan' | 'addon';

/**
 * How the editor reaches the membership screen without dropping input: leave when nothing was
 * typed, save first (quota dialog) when no use is left, else show it over the kept form.
 */
export const membershipRoute = (dirty: boolean, outOfQuota: boolean) =>
  !dirty ? 'leave' : outOfQuota ? 'save-first' : 'over-editor';

export const MAYBE_SAVED_MESSAGE =
  'Không nhận được xác nhận từ máy chủ. Tin có thể đã được lưu: hãy kiểm tra danh sách tin trước khi gửi lại để tránh tạo trùng. Nếu rời biểu mẫu, nội dung đang nhập không được giữ.';
export const RESEND_CONFIRM = {
  title: 'Gửi lại có thể tạo tin trùng',
  description:
    'Lần gửi trước chưa được máy chủ xác nhận. Chỉ gửi lại khi bạn đã kiểm tra danh sách tin và không thấy tin này.',
  confirmLabel: 'Vẫn gửi lại',
  cancelLabel: 'Quay lại',
  tone: 'warning' as const,
};

type FlagStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<unknown>;
};
// Also kept in memory, so a failing storage cannot lift the question while the app runs.
const maybeSaved = new Set<string>();

/**
 * "This new listing may already be saved", kept per account and per create / duplicate source, so
 * reopening the form still asks. An edit has none: resending it cannot create a second listing.
 */
export function maybeSavedFlag(store: FlagStore, userId: string, session: ListingEditorSession) {
  if (session.mode === 'edit') return undefined;
  const key = `homespace.listingMaybeSaved.${userId}.${session.listingId ?? 'create'}`;
  return {
    pending: async () => maybeSaved.has(key) || Boolean(await store.getItem(key).catch(() => null)),
    mark: async () => {
      maybeSaved.add(key);
      await store.setItem(key, '1').catch(() => undefined);
    },
    clear: async () => {
      maybeSaved.delete(key);
      await store.removeItem(key).catch(() => undefined);
    },
  };
}

/** Apply a loaded catalog: only a brand-new listing gets default policy answers. */
export function applyCatalog(
  state: ListingFormState,
  session: ListingEditorSession,
  catalog: ListingCatalog
): ListingFormState {
  if (session.listingId) return state;
  const listingPolicies = withDefaultSuggestions(
    state.listingPolicies,
    catalog.policies ?? [],
    categoryCode(state.basicInfo.category)
  );
  return listingPolicies === state.listingPolicies ? state : { ...state, listingPolicies };
}

export type SavedAddress = UserAddress | null | undefined;

export const amenityLabels = (catalog: ListingCatalog | null): Record<string, string> =>
  Object.fromEntries((catalog?.amenities ?? []).map((item) => [item.code, item.name]));

export function buildPayloadParams(
  state: ListingFormState,
  session: ListingEditorSession,
  catalog: ListingCatalog | null,
  savedAddress: SavedAddress,
  action: ListingSubmissionAction,
  uploadedMediaList: UploadedListingMedia[]
): BuildPayloadParams {
  const definitions = catalog?.policies ?? [];
  const { listingPolicies, selectedAddress, ...fields } = state;
  return {
    ...fields,
    id: session.mode === 'edit' ? session.listingId : null,
    duplicateSourceListingId: session.mode === 'duplicate' ? session.listingId : null,
    submissionAction: action,
    catalogAmenityCodes: (catalog?.amenities ?? []).map((item) => item.code),
    policies: policyInputs(
      withSystemRules(listingPolicies, definitions, categoryCode(state.basicInfo.category)),
      definitions
    ),
    vehicleLimits: session.vehicleLimits,
    originalCharges: session.chargeBaseline?.charges,
    originalMonthlyExpenses: session.chargeBaseline?.expenses,
    savedAddressId: savedAddress?.id,
    refId: selectedAddress?.refId,
    addressNote: selectedAddress?.addressNote ?? undefined,
    uploadedMediaList,
  };
}

export const KYC_REQUIRED_MESSAGE =
  'Vui lòng xác minh danh tính (KYC) trước khi thực hiện thao tác này.';
export const PROFILE_LOADING_MESSAGE =
  'Đang tải thông tin tài khoản. Vui lòng thử lại trong giây lát.';

export function savingMessage(mode: ListingEditorMode, action: ListingSubmissionAction) {
  if (action === 'SAVE_DRAFT')
    return mode === 'duplicate' ? 'Đang lưu bản sao dưới dạng nháp...' : 'Đang lưu tin nháp...';
  if (mode === 'duplicate') return 'Đang nhân bản tin và gửi duyệt...';
  return mode === 'edit'
    ? 'Đang cập nhật và gửi duyệt...'
    : 'Đang xử lý tải hình ảnh và gửi duyệt...';
}

export function savedMessage(
  mode: ListingEditorMode,
  action: ListingSubmissionAction,
  pendingEditId?: string | null
) {
  if (pendingEditId) return 'Bản sửa đã gửi quản trị viên. Tin vẫn giữ trạng thái hiện tại.';
  if (action === 'SAVE_DRAFT')
    return mode === 'duplicate' ? 'Đã lưu bản sao dưới dạng tin nháp' : 'Đã lưu tin nháp';
  if (mode === 'duplicate') return 'Bản sao tin đăng đã được tạo và gửi chờ duyệt';
  return mode === 'edit' ? 'Tin đăng đã được cập nhật và gửi duyệt' : 'Tin đã được gửi chờ duyệt';
}

/** Web getApiErrorMessage: field errors, then message, then detail. */
export function listingErrorMessage(error: unknown): string {
  const fallback = 'Thao tác thất bại. Vui lòng kiểm tra lại kết nối và thử lại.';
  if (isAxiosError(error) && error.response?.data) {
    const data = error.response.data as {
      message?: unknown;
      errors?: { field?: string; message?: string }[];
      detail?: string | { msg?: string }[];
    };
    if (Array.isArray(data.errors)) {
      const messages = data.errors
        .map((item) => (item.field ? `${item.field}: ${item.message}` : item.message))
        .filter(Boolean);
      if (messages.length) return messages.join('; ');
    }
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim();
    if (Array.isArray(data.detail)) {
      const details = data.detail.map((item) => item.msg).filter(Boolean);
      if (details.length) return details.join('; ');
    }
    return fallback;
  }
  // Local errors (upload, session) already carry a Vietnamese message.
  return !isAxiosError(error) && error instanceof Error && error.name === 'Error'
    ? error.message
    : fallback;
}

export type SaveListingInput = {
  state: ListingFormState;
  session: ListingEditorSession;
  catalog: ListingCatalog | null;
  /** CATALOG_LOADING / load failure / '' */
  catalogError: string;
  savedAddress: SavedAddress;
  action: ListingSubmissionAction;
  /** Wizard step 6 or edit: scroll to every invalid field, not only the first step's. */
  singlePage?: boolean;
};

export type SaveListingCallbacks = {
  /** Validation passed: abort the description job, lock the form, show the loading text. */
  onStart?: (loadingMessage: string) => void;
  /** Store it with markUploaded so a retry skips this file. */
  onMediaUploaded?: (kind: ListingMediaKind, index: number, storageObjectId: string) => void;
  /** An earlier send was never confirmed: true only when the user chooses to send again. */
  confirmResend?: () => Promise<boolean>;
};

export type SaveListingResult =
  | { status: 'saved'; id: string; pendingEditId?: string | null; message: string }
  | { status: 'invalid'; validation: ValidationResult; message: string }
  /** `cancelled`: the user declined to send again; show nothing. */
  | { status: 'kyc' | 'locked' | 'quota' | 'cancelled'; message: string }
  /**
   * `externallyRented`: set session.status to RENTED_EXTERNALLY so the lock screen shows.
   * `maybeSaved`: a new listing may exist on the server; never resend without asking.
   */
  | { status: 'error'; message: string; externallyRented?: boolean; maybeSaved?: boolean };

/** Never throws. The caller must ignore a second tap while one save is running. */
export async function saveListing(
  input: SaveListingInput & { profile: { kycVerified?: boolean | null } | null },
  deps: SaveListingCallbacks & {
    upload: (file: LocalFile, kind: ListingMediaKind) => Promise<string>;
    upsert: (payload: ListingPayload) => Promise<{ id: string; pendingEditId?: string | null }>;
    unconfirmed?: ReturnType<typeof maybeSavedFlag>;
  }
): Promise<SaveListingResult> {
  const { state, session, catalog, savedAddress, action, profile } = input;
  const edit = session.mode === 'edit';
  if (edit && !session.listingId) return { status: 'error', message: MISSING_EDIT_ID_ERROR };
  if (!profile) return { status: 'error', message: PROFILE_LOADING_MESSAGE };
  if (profile.kycVerified !== true) return { status: 'kyc', message: KYC_REQUIRED_MESSAGE };
  if (listingLock(session, state.basicInfo.title))
    return {
      status: 'locked',
      message: 'Tin đã cho thuê ngoài hệ thống, không thể chỉnh sửa hoặc gửi duyệt lại.',
    };
  const validation = validateListing(
    state,
    { definitions: catalog?.policies ?? [], error: input.catalogError },
    action,
    {
      savedAddressRefId: savedAddress?.refId,
      originalAvailableDate: session.originalAvailableDate,
      singlePage: input.singlePage ?? edit,
    }
  );
  if (!validation.ok) return { status: 'invalid', validation, message: validation.message! };
  if ((await deps.unconfirmed?.pending()) && !(await deps.confirmResend?.()))
    return { status: 'cancelled', message: '' };
  deps.onStart?.(savingMessage(session.mode, action));
  let sent = false;
  try {
    const media = await uploadListingMedia(state.basicInfo, deps.upload, deps.onMediaUploaded);
    const payload = buildCreateListingPayload(
      buildPayloadParams(state, session, catalog, savedAddress, action, media)
    );
    // Marked before the request, so an app closed while it runs still asks next time.
    await deps.unconfirmed?.mark();
    sent = true;
    const saved = await deps.upsert(payload);
    if (!saved?.id) throw new Error('Máy chủ không trả về mã tin đăng.');
    await deps.unconfirmed?.clear();
    return {
      status: 'saved',
      id: saved.id,
      pendingEditId: saved.pendingEditId,
      message: savedMessage(session.mode, action, saved.pendingEditId),
    };
  } catch (error) {
    if (isListingQuotaExhaustedError(error)) {
      if (sent) await deps.unconfirmed?.clear();
      return { status: 'quota', message: QUOTA_EXHAUSTED_MESSAGE };
    }
    // Other conflicts concern a field or a stale edit: the form stays editable.
    const externallyRented =
      edit && isAxiosError(error) && (error.response?.data as { code?: unknown })?.code === 4012;
    // Only a 4xx other than a timeout proves nothing was created; there is no idempotency key.
    const code = isAxiosError(error) ? (error.response?.status ?? 0) : 0;
    const refused = code >= 400 && code < 500 && code !== 408;
    if (sent && refused) await deps.unconfirmed?.clear();
    return {
      status: 'error',
      message: listingErrorMessage(error),
      externallyRented,
      ...(sent && !edit && !refused && { maybeSaved: true }),
    };
  }
}
