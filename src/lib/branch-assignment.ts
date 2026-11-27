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

/* ---------- room codes: the map is the standard ---------- */

/** Server rule: trimmed, case-insensitive. */
export const sameRoomCode = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The code a listing declares when it differs from its cell's. Absent, empty or null (a whole house
 * declares none) means nothing to warn about.
 */
export function codeMismatch(
  cellCode: string | null | undefined,
  listingCode: string | null | undefined
): string | null {
  const declared = listingCode?.trim();
  return declared && cellCode != null && !sameRoomCode(declared, cellCode) ? declared : null;
}

/** Rooms whose linked listings declare another code than the cell, for the marker on the map. */
export function mismatchedRoomIds(rooms: RoomAssignment[], options: RoomOption[]): Set<string> {
  const codes = new Map(options.map((room) => [room.id, room.code]));
  return new Set(
    rooms
      .filter((room) =>
        room.listings.some((listing) => codeMismatch(codes.get(room.roomId), listing.roomCode))
      )
      .map((room) => room.roomId)
  );
}

/** Another cell of the map already uses `code`, so the cell cannot be renamed to it. */
export const codeTaken = (options: RoomOption[], roomId: string, code: string) =>
  options.some((room) => room.id !== roomId && sameRoomCode(room.code, code));

/** What a candidate row says about its declared code; empty when it declares none. */
export function candidateCodeNote(cellCode: string | null | undefined, code: string | null | undefined) {
  const declared = code?.trim();
  if (!declared) return '';
  return codeMismatch(cellCode, declared)
    ? `Mã trên tin: ${declared}, khác mã ô ${cellCode}.`
    : `Mã trên tin: ${declared}.`;
}

/** Listings with the cell's own code first; otherwise the server's order. */
export function sortCandidates<T extends { roomCode?: string | null }>(
  items: T[],
  cellCode: string | null | undefined
): T[] {
  if (cellCode == null) return items;
  const same = (item: T) => (item.roomCode?.trim() && !codeMismatch(cellCode, item.roomCode) ? 0 : 1);
  return [...items].sort((a, b) => same(a) - same(b));
}

export const MAX_CANDIDATE_PAGES = 25;

/**
 * Every candidate, so that search and "same code first" see them all. The server has no search, only
 * pages; this reads at most MAX_CANDIDATE_PAGES of them and says when more exist.
 */
export async function loadAllCandidates(
  get: (page: number) => Promise<PageOf<AssignmentCandidate>>
): Promise<{ items: AssignmentCandidate[]; total: number }> {
  const first = await get(0);
  const pages = Math.min(pageCount(first), MAX_CANDIDATE_PAGES);
  const items = [...first.items];
  for (let page = 1; page < pages; page++) items.push(...(await get(page)).items);
  const seen = new Set<string>();
  return {
    items: items.filter((item) => !seen.has(item.id) && seen.add(item.id)),
    total: first.totalElements,
  };
}

/* ---------- the one main action of a room ---------- */

export type PrimaryAction =
  | { kind: 'contract'; id: string; label: string }
  | { kind: 'hold'; id: string; label: string }
  | { kind: 'listing'; id: string; label: string }
  | { kind: 'post'; label: string };

/** Running contract, else a hold, else the listing, else start a listing for the free room. */
export function primaryAction(room: RoomAssignment): PrimaryAction {
  const contract = sortContracts(room.contracts).find((item) => !ENDED.has(item.status));
  if (contract) return { kind: 'contract', id: contract.id, label: 'Mở hợp đồng' };
  if (room.holds[0])
    return { kind: 'hold', id: room.holds[0].rentalRequestId, label: 'Mở hồ sơ thuê' };
  if (room.listings[0]) return { kind: 'listing', id: room.listings[0].id, label: 'Mở tin' };
  return { kind: 'post', label: 'Đăng tin cho phòng này' };
}

export const editListingDestination = (listingId: string): BranchDestination => ({
  kind: 'edit-listing',
  listingId,
});
