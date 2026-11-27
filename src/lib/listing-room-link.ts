// Port of hs-web-app lib/listing-room-link.ts: a new listing started from a room of the branch map.
// The web reads URL params; the phone passes the same values as screen props. No runtime imports.
import type { ListingFormState } from '@/lib/listing-form';
import type { ListingPayload } from '@/lib/listing-payload';
import type { BranchLayout } from '@/types/branch-layout';

export interface ListingRoom {
  id: string;
  label: string;
  /** Code of the cell on the map. */
  code: string;
}

export interface RoomLink {
  branchId: string;
  roomId: string;
}

export const ROOM_GONE_MESSAGE =
  'Phòng đã chọn không còn trong sơ đồ. Vui lòng chọn lại phòng trước khi tạo tin.';
export const ROOM_BRANCH_MESSAGE =
  'Chưa áp dụng được chi nhánh của phòng. Vui lòng chọn lại chi nhánh hoặc bỏ gắn phòng.';
export const ROOM_DROPPED_MESSAGE = 'Đã đổi chi nhánh nên tin mới sẽ không gắn với phòng đã chọn.';

/** The room a new listing was started from. Only a plain create can carry it, never edit or duplicate. */
export function readRoomLink(options: {
  listingId?: string;
  duplicateFromId?: string;
  branchId?: string;
  roomId?: string;
}): RoomLink | null {
  const { listingId, duplicateFromId, branchId, roomId } = options;
  if (listingId || duplicateFromId || !branchId || !roomId) return null;
  return { branchId, roomId };
}

/** Cells with a room code are rooms; the others are aisles and cannot take a link. */
export function listRooms(layout: BranchLayout): ListingRoom[] {
  return (layout.floors ?? []).flatMap((floor) =>
    (floor.rows ?? []).flatMap((row) =>
      (row.slots ?? []).flatMap((slot) =>
        slot.roomCode
          ? [{ id: slot.id, code: slot.roomCode, label: `${slot.roomCode} · ${floor.label} · ${row.label}` }]
          : []
      )
    )
  );
}

/** Without a room, or for an existing or copied listing, the request is returned untouched. */
export function withRoomId(
  request: ListingPayload,
  roomId: string | null | undefined
): ListingPayload & { roomId?: string } {
  return roomId && !request.id && !request.duplicateSourceListingId
    ? { ...request, roomId }
    : request;
}

/**
 * A listing started from a room: the room's code goes into the room code (ROOM) or unit number
 * (APARTMENT) while that field is empty. Never into the title. Anything else is returned untouched.
 */
export function prefillRoomCode(state: ListingFormState, code: string): ListingFormState {
  const value = code.trim();
  if (!value) return state;
  if (state.basicInfo.category === 'room' && !state.roomDetails.roomCode?.trim())
    return { ...state, roomDetails: { ...state.roomDetails, roomCode: value } };
  if (state.basicInfo.category === 'apartment' && !state.apartmentDetails.unitNumber?.trim())
    return { ...state, apartmentDetails: { ...state.apartmentDetails, unitNumber: value } };
  return state;
}
