// Port of hs-web-app lib/listing-description-request.ts and the generate flow of ListingEditor.tsx.
import type { ListingFormState } from '@/lib/listing-form';
import {
  amenityLabels,
  buildPayloadParams,
  type ListingEditorSession,
  type SavedAddress,
} from '@/lib/listing-editor';
import { buildCreateListingPayload, type ListingPayload } from '@/lib/listing-payload';
import type { ListingCatalog } from '@/services/listingCreateApi';

type Address = { street?: string | null; ward?: string | null; city?: string | null };

/** What will be published -> flat facts. Title, media and address note stay out (no personal data). */
export function toDescriptionRequest(
  payload: ListingPayload,
  address: Address | null | undefined,
  labels: Record<string, string>
) {
  const { pricing, apartmentDetail: apartment, houseDetail: house, roomDetail: room } = payload;
  return {
    category: payload.category,
    areaM2: payload.areaM2,
    price: pricing.amount,
    priceUnit: pricing.unit,
    negotiable: pricing.negotiable,
    depositType: pricing.depositType,
    depositAmount: pricing.depositAmount,
    depositMonths: pricing.depositMonths,
    minimumLeaseMonths: pricing.minimumLeaseMonths,
    availableFrom: payload.availableFrom,
    street: address?.street,
    ward: address?.ward,
    city: address?.city,
    furnishingStatus: (apartment ?? house ?? room)!.furnishingStatus,
    furnishings: payload.furnishings.map((f) => ({ name: f.assetName, quantity: f.quantity })),
    amenities: [
      ...payload.amenityCodes.map((code) => labels[code] ?? code),
      ...payload.customAmenities,
    ],
    charges: payload.charges.map((c) => ({
      type: c.chargeType,
      method: c.billingMethod,
      amount: c.amount,
      includedInRent: c.includedInRent,
      name: c.customName,
    })),
    ...(apartment && {
      projectName: apartment.projectName,
      buildingBlock: apartment.buildingBlock,
      floorNumber: apartment.floorNumber,
      totalFloors: apartment.buildingTotalFloors,
      bedrooms: apartment.bedroomCount,
      bathrooms: apartment.bathroomCount,
      livingRooms: apartment.livingRoomCount,
      kitchens: apartment.kitchenCount,
      doorDirection: apartment.mainDoorDirection,
      balconyDirection: apartment.balconyDirection,
      view: apartment.viewDescription,
      maxOccupants: apartment.maxOccupants,
    }),
    ...(house && {
      totalFloors: house.totalFloors,
      bedrooms: house.bedroomCount,
      bathrooms: house.bathroomCount,
      livingRooms: house.livingRoomCount,
      kitchens: house.kitchenCount,
      landAreaM2: house.landAreaM2,
      frontageWidthM: house.frontageWidthM,
      lengthM: house.lengthM,
      roadWidthM: house.accessRoadWidthM,
      frontageCount: house.frontageCount,
      hasRooftop: house.hasRooftop,
      hasGarage: house.hasGarage,
      accessType: house.accessType,
      maxOccupants: house.maxOccupants,
      maxVehicles: house.maxVehicles,
    }),
    ...(room && {
      roomCode: room.roomCode,
      floorNumber: room.floorNumber,
      restroomType: room.restroomType,
      kitchenType: room.kitchenType,
      hasWindow: room.hasWindow,
      balconyType: room.balconyType,
      hasMezzanine: room.hasMezzanine,
      accessType: room.accessType,
      accessHoursType: room.accessHoursType,
      electricMeterType: room.electricMeterType,
      waterMeterType: room.waterMeterType,
      parkingPolicy: room.parkingPolicy,
      maxOccupants: room.maxOccupants,
      maxVehicles: room.maxVehicles,
    }),
  };
}

export type ListingDescriptionRequest = ReturnType<typeof toDescriptionRequest> & {
  previousTemplateId?: string | null;
};
export type ListingDescriptionResponse = { description: string; templateId: string };

export function buildDescriptionRequest(
  state: ListingFormState,
  session: ListingEditorSession,
  catalog: ListingCatalog | null,
  savedAddress: SavedAddress
) {
  return toDescriptionRequest(
    buildCreateListingPayload(
      buildPayloadParams(state, session, catalog, savedAddress, 'SAVE_DRAFT', [])
    ),
    state.addressMode === 'saved' ? savedAddress : state.selectedAddress,
    amenityLabels(catalog)
  );
}

/** Shown after `validateListing(..., 'SUBMIT_FOR_REVIEW', { skipDescription: true })` fails. */
export const DESCRIPTION_BLOCKED_MESSAGE =
  'Vui lòng hoàn thành các thông tin bắt buộc để có đủ dữ liệu tạo mô tả.';
export const DESCRIPTION_REPLACE_CONFIRM = {
  title: 'Thay thế mô tả hiện tại?',
  description: 'Nội dung bạn đang có trong ô mô tả sẽ được thay bằng mô tả mới.',
  confirmLabel: 'Thay thế',
};
/** Rotate every 1300 ms while generating; stay on the last one. */
export const DESCRIPTION_STEPS = [
  'Đang phân tích thông tin…',
  'Đang chọn cách trình bày…',
  'Đang viết mô tả…',
  'Đang rà soát nội dung…',
];

export type DescriptionResult =
  /** busy / cancelled: show nothing. */
  | { status: 'busy' | 'cancelled' }
  | { status: 'stale' | 'error'; message: string }
  | { status: 'done'; description: string; message: string };

/**
 * One per editor instance. Single flight; `abort()` on unmount and when a save starts.
 * `read` must return the form as it is now (use a ref), not as it was on tap.
 */
export function createDescriptionJob(deps: {
  read: () => { facts: ListingDescriptionRequest; description: string };
  fetch: (
    body: ListingDescriptionRequest,
    signal: AbortSignal
  ) => Promise<ListingDescriptionResponse>;
}) {
  let current: AbortController | null = null;
  let previousTemplateId: string | null = null;
  return {
    abort: () => current?.abort(),
    async run(
      confirmReplace: () => Promise<boolean>,
      onGenerating?: () => void
    ): Promise<DescriptionResult> {
      if (current) return { status: 'busy' };
      const { facts, description } = deps.read();
      const controller = new AbortController();
      current = controller;
      try {
        if (description.trim() && !(await confirmReplace())) return { status: 'cancelled' };
        if (controller.signal.aborted) return { status: 'cancelled' };
        onGenerating?.();
        const result = await deps.fetch({ ...facts, previousTemplateId }, controller.signal);
        if (controller.signal.aborted) return { status: 'cancelled' };
        const now = deps.read();
        if (JSON.stringify(now.facts) !== JSON.stringify(facts) || now.description !== description)
          return {
            status: 'stale',
            message: 'Thông tin tin đăng đã thay đổi trong lúc tạo mô tả. Vui lòng bấm tạo lại.',
          };
        previousTemplateId = result.templateId;
        return {
          status: 'done',
          description: result.description,
          message: 'Đã tạo mô tả. Bạn có thể chỉnh sửa trước khi đăng.',
        };
      } catch (error) {
        if (controller.signal.aborted) return { status: 'cancelled' };
        // Only the route's own messages are Vietnamese; network and timeout errors are not.
        return {
          status: 'error',
          message:
            error instanceof Error && error.name === 'Error'
              ? error.message
              : 'Không tạo được mô tả. Vui lòng thử lại.',
        };
      } finally {
        current = null;
      }
    },
  };
}
