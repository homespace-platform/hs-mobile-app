// Port of collectErrors / validatePolicies / step navigation of hs-web-app ListingEditor.tsx.
import {
  categoryCode,
  getTodayDateString,
  isFurnishingRequired,
  type ListingEditorMode,
  type ListingFormState,
} from '@/lib/listing-form';
import { withSystemRules, type ListingPolicyDefinition } from '@/lib/listing-policy';
import type { ListingSubmissionAction } from '@/services/listingCreateApi';

export const WIZARD_STEPS = [
  { id: 1, label: 'Thông tin cơ bản' },
  { id: 2, label: 'Chi tiết & tiện ích' },
  { id: 3, label: 'Giá & chi phí' },
  { id: 4, label: 'Chính sách & lịch xem' },
  { id: 5, label: 'Vị trí & mô tả' },
  { id: 6, label: 'Kiểm tra & gửi' },
] as const;
export const POLICY_STEP = 4;
export const LAST_STEP = 6;

export type ListingSectionId =
  | 'basic-info'
  | 'details'
  | 'amenities'
  | 'policies'
  | 'monthly-expenses'
  | 'pricing'
  | 'location'
  | 'viewing-schedule'
  | 'description';

/** Section order of the single page (edit screen and wizard step 6). */
export const EDIT_SECTIONS: { id: ListingSectionId; label: string }[] = [
  { id: 'basic-info', label: 'Thông tin cơ bản' },
  { id: 'details', label: 'Chi tiết' },
  { id: 'amenities', label: 'Tiện ích' },
  { id: 'policies', label: 'Chính sách' },
  { id: 'monthly-expenses', label: 'Chi phí hàng tháng' },
  { id: 'pricing', label: 'Giá & điều kiện' },
  { id: 'location', label: 'Vị trí' },
  { id: 'viewing-schedule', label: 'Lịch xem nhà' },
  { id: 'description', label: 'Mô tả' },
];

/** Sections of each wizard step, in display order. */
export const STEP_SECTIONS: Record<number, ListingSectionId[]> = {
  1: ['basic-info'],
  2: ['details', 'amenities'],
  3: ['pricing', 'monthly-expenses'],
  4: ['policies', 'viewing-schedule'],
  5: ['location', 'description'],
  6: EDIT_SECTIONS.map((section) => section.id),
};

/** `id` is the web anchor (several rows may share it); `key` indexes the error map. */
export type ListingFieldError = { step: number; id: string; key: string; msg: string };

export type ValidationContext = {
  savedAddressRefId?: string | null;
  today?: string;
  /** Edit only: this past date is still valid while unchanged. */
  originalAvailableDate?: string | null;
};
/** Server limit (CreateListingRequest.description); checked before any upload. */
export const DESCRIPTION_MAX = 5000;

export function collectErrors(
  state: ListingFormState,
  context: ValidationContext = {},
  skipDescription = false
): ListingFieldError[] {
  const { basicInfo, apartmentDetails, houseDetails, roomDetails, pricing } = state;
  const list: ListingFieldError[] = [];
  let step = 1;
  const addError = (id: string, key: string, msg: string) => {
    list.push({ step, id, key, msg });
  };

  if (!basicInfo.title.trim()) {
    addError('field-title', 'title', 'Vui lòng nhập tiêu đề bài đăng.');
  } else if (basicInfo.title.trim().length < 15) {
    addError('field-title', 'title', 'Tiêu đề quá ngắn (tối thiểu 15 ký tự).');
  }

  if (basicInfo.images.length === 0) {
    addError('field-images', 'images', 'Vui lòng tải lên ít nhất 1 hình ảnh thực tế.');
  }

  const today = context.today ?? getTodayDateString();
  if (!basicInfo.availableDate) {
    addError(
      'field-available-date',
      'availableDate',
      'Vui lòng chọn ngày có thể vào thuê / bàn giao.'
    );
  } else if (
    basicInfo.availableDate < today &&
    basicInfo.availableDate !== context.originalAvailableDate
  ) {
    addError(
      'field-available-date',
      'availableDate',
      'Ngày có thể vào thuê / bàn giao không được ở trong quá khứ.'
    );
  }

  step = 2;
  if (basicInfo.category === 'apartment') {
    if (!apartmentDetails.projectName.trim()) {
      addError('field-project-name', 'projectName', 'Vui lòng nhập tên dự án / tòa nhà.');
    }
    if (!apartmentDetails.areaM2 || Number(apartmentDetails.areaM2) <= 0) {
      addError('field-area-m2', 'areaM2', 'Diện tích căn hộ phải lớn hơn 0.');
    }
    if (!apartmentDetails.floor) {
      addError('field-floor', 'floor', 'Vui lòng nhập số tầng của căn hộ.');
    }
  } else if (basicInfo.category === 'house') {
    if (!houseDetails.totalUsableAreaM2 || Number(houseDetails.totalUsableAreaM2) <= 0) {
      addError(
        'field-total-usable-area',
        'totalUsableAreaM2',
        'Tổng diện tích sử dụng phải lớn hơn 0.'
      );
    }
    if (!houseDetails.totalFloors || Number(houseDetails.totalFloors) <= 0) {
      addError('field-total-floors', 'totalFloors', 'Số tầng phải lớn hơn 0.');
    } else if (Number(houseDetails.totalFloors) < (houseDetails.rentedFloorTo ?? 0)) {
      // The stored rental scope has no input: it must stay inside the building.
      const { rentedFloorFrom: from, rentedFloorTo: to } = houseDetails;
      addError(
        'field-total-floors',
        'totalFloors',
        `Tin đang cho thuê ${from != null ? `tầng ${from}–${to}` : `đến tầng ${to}`}, tổng số tầng không được nhỏ hơn ${to}.`
      );
    }
  } else {
    if (!roomDetails.areaM2 || Number(roomDetails.areaM2) <= 0) {
      addError('field-room-area', 'areaM2', 'Diện tích phòng phải lớn hơn 0.');
    }
    if (!roomDetails.roomCode?.trim()) {
      addError('field-room-code', 'roomCode', 'Vui lòng nhập mã phòng / tên phòng.');
    }
    if (!roomDetails.maxOccupants || Number(roomDetails.maxOccupants) <= 0) {
      addError('field-max-occupants', 'maxOccupants', 'Số người ở tối đa phải lớn hơn 0.');
    }
  }

  if (basicInfo.category === 'apartment' || basicInfo.category === 'house') {
    const { bedrooms, bathrooms } =
      basicInfo.category === 'apartment' ? apartmentDetails : houseDetails;
    const minBedrooms = basicInfo.category === 'apartment' ? 0 : 1; // 0 = studio
    if (String(bedrooms ?? '') === '' || !(Number(bedrooms) >= minBedrooms)) {
      addError('field-bedrooms', 'bedrooms', 'Vui lòng nhập số phòng ngủ hợp lệ.');
    }
    if (!(Number(bathrooms) >= 1)) {
      addError('field-bathrooms', 'bathrooms', 'Số phòng tắm / WC phải từ 1 trở lên.');
    }
  }

  if (isFurnishingRequired(state) && state.furnishingAssets.length === 0) {
    addError(
      'field-furnishing-assets',
      'furnishingAssets',
      'Vui lòng kê khai ít nhất một tài sản / trang thiết bị bàn giao.'
    );
  }
  state.furnishingAssets.forEach((row, index) => {
    if (!row.assetName.trim()) {
      addError(
        'field-furnishing-assets',
        `furnishingAssets.${index}.assetName`,
        'Vui lòng nhập tên tài sản.'
      );
    }
    if (!row.quantity || Number(row.quantity) < 1) {
      addError(
        'field-furnishing-assets',
        `furnishingAssets.${index}.quantity`,
        'Số lượng phải từ 1 trở lên.'
      );
    }
  });

  step = 3;
  if (!pricing.priceMonthly || Number(pricing.priceMonthly) <= 0) {
    addError('field-price-monthly', 'priceMonthly', 'Vui lòng nhập giá cho thuê hợp lệ.');
  }
  if (
    pricing.depositType === 'AMOUNT' &&
    (!pricing.depositAmount || Number(pricing.depositAmount) <= 0)
  ) {
    addError('field-deposit-amount', 'depositAmount', 'Vui lòng nhập số tiền đặt cọc.');
  }
  if (
    pricing.depositType === 'MONTHS' &&
    (!Number.isSafeInteger(Number(pricing.depositMonths)) || Number(pricing.depositMonths) <= 0)
  ) {
    addError('field-deposit-months', 'depositMonths', 'Số tháng đặt cọc phải là số nguyên dương.');
  }
  if (!(Number(pricing.minimumLeaseMonths) >= 1)) {
    addError(
      'field-minimum-lease',
      'minimumLeaseMonths',
      'Thời hạn thuê tối thiểu phải từ 1 tháng.'
    );
  }

  step = 4;
  if (state.selectedViewingDays.length === 0) {
    addError('field-viewing-days', 'viewingDays', 'Vui lòng chọn ít nhất một ngày trong tuần.');
  }
  if (state.selectedViewingSlots.length === 0) {
    addError('field-viewing-slots', 'viewingSlots', 'Vui lòng chọn ít nhất một buổi có thể xem.');
  }

  step = 5;
  if (state.addressMode === 'saved' ? !context.savedAddressRefId : !state.selectedAddress?.refId) {
    addError('field-street-line', 'streetLine', 'Vui lòng chọn địa chỉ từ kết quả Vietmap.');
  }
  if (!skipDescription) {
    if (!basicInfo.description.trim()) {
      addError('field-description', 'description', 'Vui lòng nhập mô tả chi tiết bài đăng.');
    } else if (basicInfo.description.trim().length < 30) {
      addError('field-description', 'description', 'Mô tả chi tiết quá ngắn (tối thiểu 30 ký tự).');
    } else if (basicInfo.description.trim().length > DESCRIPTION_MAX) {
      addError(
        'field-description',
        'description',
        `Mô tả chi tiết quá dài (tối đa ${DESCRIPTION_MAX} ký tự).`
      );
    }
  }
  return list;
}

export const errorMap = (list: ListingFieldError[]): Record<string, string> =>
  Object.fromEntries(list.map((error) => [error.key, error.msg]));

export type PolicyCatalogState = {
  definitions: ListingPolicyDefinition[];
  /** Non-empty while loading or when the catalog is unusable. */
  error: string;
};

/** Message to show (under `errors.policies`), or null when the policies may be sent. */
export function validatePolicies(
  state: ListingFormState,
  catalog: PolicyCatalogState,
  action: ListingSubmissionAction
): string | null {
  const { definitions } = catalog;
  // A draft saved without the catalog would send policies: [] and drop what was already entered.
  if (
    (action === 'SUBMIT_FOR_REVIEW' || state.listingPolicies.length > 0) &&
    (catalog.error || !definitions.length)
  ) {
    return catalog.error || 'Chưa tải danh mục chính sách.';
  }
  const rows = withSystemRules(
    state.listingPolicies,
    definitions,
    categoryCode(state.basicInfo.category)
  );
  for (const d of definitions) {
    const p = rows.find((row) => row.code === d.code);
    if (
      p?.value &&
      d.valueType === 'INTEGER' &&
      (!Number.isInteger(Number(p.value)) ||
        (d.minimumValue != null && Number(p.value) < d.minimumValue) ||
        (d.maximumValue != null && Number(p.value) > d.maximumValue))
    ) {
      return `${d.label}: nhập số nguyên từ ${d.minimumValue ?? 0} đến ${d.maximumValue ?? 'giới hạn quy định'}.`;
    }
  }
  if (action === 'SUBMIT_FOR_REVIEW') {
    const missing = definitions.find(
      (d) => d.required && !rows.some((row) => row.code === d.code && row.value.trim())
    );
    if (missing) return `Cần nhập chính sách: ${missing.label}`;
  }
  return null;
}

export type ValidationResult = {
  ok: boolean;
  /** Replace the whole error map with this. */
  errors: Record<string, string>;
  /** Step to show and field ids to scroll to; set when not ok. */
  step?: number;
  focusIds?: string[];
  /** Show as toast/dialog. */
  message?: string;
};

function reveal(list: ListingFieldError[], singlePage: boolean): ValidationResult {
  const first = list[0];
  return {
    ok: false,
    errors: errorMap(list),
    step: first.step,
    focusIds: list.filter((e) => singlePage || e.step === first.step).map((e) => e.id),
    message: first.msg,
  };
}

const policyFailure = (message: string): ValidationResult => ({
  ok: false,
  errors: { policies: message },
  step: POLICY_STEP,
  focusIds: ['section-policies'],
  message,
});

export const isSinglePage = (mode: ListingEditorMode, step: number) =>
  mode === 'edit' || step === LAST_STEP;

/** Full check before save/submit (fields first, then policies). */
export function validateListing(
  state: ListingFormState,
  catalog: PolicyCatalogState,
  action: ListingSubmissionAction,
  context: ValidationContext & { singlePage?: boolean; skipDescription?: boolean } = {}
): ValidationResult {
  const list = collectErrors(state, context, context.skipDescription);
  if (list.length) return reveal(list, context.singlePage ?? false);
  const message = validatePolicies(state, catalog, action);
  return message ? policyFailure(message) : { ok: true, errors: {} };
}

/** "Tiếp tục": only this step's fields; the policy step also needs complete policies. */
export function validateStep(
  state: ListingFormState,
  catalog: PolicyCatalogState,
  step: number,
  context: ValidationContext = {}
): ValidationResult {
  const list = collectErrors(state, context).filter((error) => error.step === step);
  if (list.length) return reveal(list, false);
  const message =
    step === POLICY_STEP ? validatePolicies(state, catalog, 'SUBMIT_FOR_REVIEW') : null;
  return message ? policyFailure(message) : { ok: true, errors: {} };
}

/** Stepper: steps up to this one are tappable (create/duplicate). */
export const firstInvalidStep = (state: ListingFormState, context: ValidationContext = {}) =>
  collectErrors(state, context)[0]?.step ?? LAST_STEP;
