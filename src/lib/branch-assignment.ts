/**
 * Port of hs-web-app lib/branch-assignment.ts. Business rules live on the server; these only read its
 * responses and decide what the screen can offer. Web paths are replaced by BranchDestination builders.
 */
import type { BranchDestination } from '@/lib/branch-nav';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import { contractStatus } from '@/lib/rental/rental-labels';
import type {
  AssignmentCandidate,
  AssignmentKind,
  BranchAssignments,
  PageOf,
  RoomAssignment,
  RoomContractLink,
  RoomManualStatus,
  RoomOption,
} from '@/types/branch-assignment';
import type { LayoutDraft } from '@/types/branch-layout';

export const PAGE_SIZE = 20;

export const MANUAL_STATUS_LABEL: Record<RoomManualStatus, string> = {
  NONE: 'Không đánh dấu',
  EXTERNAL_RENT: 'Thuê ngoài',
  REPAIR: 'Đang sửa chữa',
};

const LISTING_STATUS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  PUBLISHED: 'Đang đăng',
  RESERVED: 'Đang giữ chỗ',
  RENTED: 'Đã cho thuê',
  RENTED_EXTERNALLY: 'Đã thuê ngoài',
  EXPIRED: 'Hết hạn',
  REJECTED: 'Bị từ chối',
  HIDDEN: 'Đã ẩn',
  VIOLATION: 'Vi phạm',
};

export const listingStatusLabel = (status: string) => LISTING_STATUS[status] ?? 'Đang cập nhật';
export const contractStatusLabel = (status: string) => contractStatus(status).label;

/** "2026-11-26..." -> "26/11/2026", without time zone conversion; anything else -> "". */
export function formatDay(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/* ---------- links to existing screens ---------- */

export const newRoomListingDestination = (branchId: string, roomId: string): BranchDestination => ({
  kind: 'new-listing',
  branchId,
  roomId,
});
export const rentalRequestDestination = (requestId: string): BranchDestination => ({
  kind: 'rental',
  route: { screen: 'rental-requests', mode: 'RECEIVED', requestId },
});
export const itemDestination = (kind: AssignmentKind, id: string): BranchDestination =>
  kind === 'CONTRACT'
    ? { kind: 'rental', route: contractDetailPath('landlord', id) }
    : { kind: 'listing', listingId: id };

/* ---------- responses ---------- */

const BAD_RESPONSE = 'Máy chủ trả về dữ liệu không đúng định dạng.';

function parsePage<T>(value: unknown): PageOf<T> {
  const page = value as PageOf<T> | null | undefined;
  if (
    !page ||
    !Array.isArray(page.items) ||
    ![page.page, page.size, page.totalElements].every(Number.isFinite)
  ) {
    throw new Error(BAD_RESPONSE);
  }
  return page;
}

/** Rejects anything that is not the agreed shape (e.g. an HTML page); fills lists the server left out. */
export function parseAssignments(value: unknown): BranchAssignments {
  const result = value as BranchAssignments | null | undefined;
  if (!result || !Array.isArray(result.rooms)) throw new Error(BAD_RESPONSE);
  return {
    rooms: result.rooms.map((r) => ({
      roomId: r.roomId,
      manualStatus: r.manualStatus ?? 'NONE',
      listings: r.listings ?? [],
      contracts: r.contracts ?? [],
      holds: r.holds ?? [],
    })),
    unplaced: parsePage(result.unplaced),
  };
}

export function parseCandidates(value: unknown): PageOf<AssignmentCandidate> {
  const page = parsePage<AssignmentCandidate>(value);
  return { ...page, items: page.items.map((c) => ({ ...c, roomId: c.roomId ?? null })) };
}

export const pageCount = (page: { size: number; totalElements: number }) =>
  Math.max(1, Math.ceil(page.totalElements / Math.max(1, page.size)));

/* ---------- rooms ---------- */

export const emptyRoom = (roomId: string): RoomAssignment => ({
  roomId,
  manualStatus: 'NONE',
  listings: [],
  contracts: [],
  holds: [],
});

/** Rooms of the saved map, in on-screen order. Cells without an id or code cannot hold links. */
export function roomOptions(saved: LayoutDraft): RoomOption[] {
  return saved.flatMap((f) =>
    f.rows.flatMap((r) =>
      r.slots.flatMap((s) =>
        s.id && s.roomCode !== null
          ? [{ id: s.id, code: s.roomCode, label: `${s.roomCode} · ${f.label}, ${r.label}` }]
          : []
      )
    )
  );
}

const ENDED = new Set(['CLOSED', 'TERMINATED', 'CANCELLED']);
const contractRank = (c: RoomContractLink) =>
  c.status === 'ACTIVE' ? 0 : ENDED.has(c.status) ? 2 : 1;
/** Running contract first, ended ones last, so a cell never leads with history. */
export const sortContracts = (contracts: RoomContractLink[]) =>
  [...contracts].sort((a, b) => contractRank(a) - contractRank(b));

/** Short text shown inside a map cell. */
export function roomLines(room: RoomAssignment): string[] {
  const lines: string[] = [];
  if (room.manualStatus !== 'NONE')
    lines.push(MANUAL_STATUS_LABEL[room.manualStatus] ?? 'Đang cập nhật');
  const [first, ...rest] = sortContracts(room.contracts);
  if (first)
    lines.push(`HĐ: ${first.tenantName || 'chưa có tên'} (${contractStatusLabel(first.status)})`);
  if (rest.length) lines.push(`+${rest.length} HĐ khác`);
  if (room.holds.length) {
    const more = room.holds.length > 1 ? ` +${room.holds.length - 1}` : '';
    lines.push(`Giữ chỗ: ${room.holds[0].tenantName || 'chưa có tên'}${more}`);
  }
  if (room.listings.length) lines.push(`${room.listings.length} tin đăng`);
  return lines;
}

function attachmentText(room: RoomAssignment): string {
  return [
    room.contracts.length ? `${room.contracts.length} hợp đồng` : '',
    room.holds.length ? `${room.holds.length} lượt giữ chỗ` : '',
    room.listings.length ? `${room.listings.length} tin đăng` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Saved rooms with attachments that saving `next` would remove (deleted, or turned into an empty cell). */
export function lostAttachedRooms(
  saved: LayoutDraft,
  next: LayoutDraft,
  rooms: Map<string, RoomAssignment>
) {
  const kept = new Set(roomOptions(next).map((r) => r.id));
  return roomOptions(saved).flatMap((r) => {
    const room = rooms.get(r.id);
    const text = room && !kept.has(r.id) ? attachmentText(room) : '';
    return text ? [{ id: r.id, code: r.code, text }] : [];
  });
}

/* ---------- what the screen allows ---------- */

/** Why linking is locked for the whole map, or null. */
export function permissionBlock(canEdit: boolean, lockMessage?: string | null): string | null {
  return canEdit ? null : (lockMessage ?? 'Bạn chưa có quyền thay đổi liên kết.');
}

/** Why actions that point at a room must wait for the map to be saved, or null. */
export function unsavedBlock(dirty: boolean, saving: boolean): string | null {
  if (saving) return 'Đang lưu sơ đồ, vui lòng đợi.';
  return dirty
    ? 'Sơ đồ có thay đổi chưa lưu. Hãy Lưu sơ đồ (hoặc Hủy thay đổi) rồi mới gắn, gỡ hoặc đăng tin cho phòng.'
    : null;
}

/** Whether a candidate can be put in `roomId` (null = the tray), and what to say about where it is now. */
export function candidateState(
  kind: AssignmentKind,
  candidate: AssignmentCandidate,
  roomId: string | null,
  rooms: RoomOption[],
  inTray = false
): { disabled: boolean; note: string; action: string } {
  const current = candidate.roomId;
  const idle = roomId === null ? 'Thêm' : 'Gắn';
  if (current) {
    if (current === roomId) return { disabled: true, note: 'Đã ở phòng này.', action: idle };
    const code = rooms.find((r) => r.id === current)?.code;
    const where = `phòng ${code ?? 'khác'}`;
    // A listing must be detached first; a contract can move between rooms of the branch.
    if (kind === 'LISTING')
      return { disabled: true, note: `Đang gắn ${where}. Hãy gỡ ở phòng đó trước.`, action: idle };
    if (roomId === null)
      return {
        disabled: true,
        note: `Đang ở ${where}. Muốn đưa về khay, hãy mở phòng đó.`,
        action: idle,
      };
    return { disabled: false, note: `Đang ở ${where}.`, action: 'Chuyển đến' };
  }
  if (inTray && roomId === null) return { disabled: true, note: 'Đã có trong khay.', action: idle };
  return { disabled: false, note: inTray ? 'Đang ở khay Chưa xếp phòng.' : '', action: idle };
}
