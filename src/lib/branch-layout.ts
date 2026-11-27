// Port of hs-web-app lib/branch-layout.ts: identical logic, only the type import path differs.
/**
 * Pure draft editing of a branch floor map. Every edit returns a new draft (or the same
 * reference when nothing changed), so undo is just a list of previous drafts.
 * No runtime imports: tests can load this file on its own.
 */
import type {
  BranchLayout,
  DraftFloor,
  DraftRow,
  DraftSlot,
  LayoutDraft,
  SaveBranchLayoutRequest,
} from '@/types/branch-layout';

export const MAX_FLOORS = 30;
export const MAX_ROOMS_PER_BATCH = 50;
const MAX_UNDO = 50;

// The random part keeps keys unique next to a draft restored from an earlier page load.
const keyPrefix = `new-${Math.random().toString(36).slice(2, 8)}`;
let keySeq = 0;
const newKey = () => `${keyPrefix}-${++keySeq}`;

const room = (roomCode: string | null): DraftSlot => ({ key: newKey(), roomCode });
const row = (label: string, slots: DraftSlot[] = []): DraftRow => ({ key: newKey(), label, slots });
const floor = (label: string, rows: DraftRow[]): DraftFloor => ({ key: newKey(), label, rows });

const range = (count: number) => Array.from({ length: Math.max(0, count) }, (_, i) => i);
const clamp = (value: number, max: number) => Math.min(max, Math.max(1, Math.floor(value) || 1));

/** Same comparison as the server: trimmed, case-insensitive. */
export const normalizeRoomCode = (code: string) => code.trim().toUpperCase();

export function usedRoomCodes(
  draft: LayoutDraft,
  exceptSlotKeys: Set<string> = new Set()
): Set<string> {
  const used = new Set<string>();
  for (const f of draft)
    for (const r of f.rows)
      for (const s of r.slots)
        if (s.roomCode !== null && !exceptSlotKeys.has(s.key))
          used.add(normalizeRoomCode(s.roomCode));
  return used;
}

export function countRooms(draft: LayoutDraft): number {
  return draft.reduce(
    (sum, f) =>
      sum + f.rows.reduce((n, r) => n + r.slots.filter((s) => s.roomCode !== null).length, 0),
    0
  );
}

/** "Tầng 3" -> 3; a label without a number falls back to its position. */
export function floorNumber(draft: LayoutDraft, floorIndex: number): number {
  const match = /\d+/.exec(draft[floorIndex]?.label ?? '');
  const value = match ? Number(match[0]) : 0;
  return value > 0 && value < 1000 ? value : floorIndex + 1;
}

/** "A09" -> "A10", skipping codes already taken. null when the code has no trailing number. */
function incrementCode(code: string, used: Set<string>): string | null {
  const match = /^(.*?)(\d+)$/.exec(code.trim());
  if (!match) return null;
  const [, prefix, digits] = match;
  // BigInt: above 2^53 a Number stops growing and this loop would never end.
  let n = BigInt(digits);
  let next: string;
  do {
    n += BigInt(1);
    next = prefix + String(n).padStart(digits.length, '0');
  } while (used.has(normalizeRoomCode(next)));
  return next;
}

/** Code suggested for a new room: continues the row, else the floor, else <floor>01. */
export function nextRoomCode(draft: LayoutDraft, rowKey: string): string {
  const used = usedRoomCodes(draft);
  const floorIndex = draft.findIndex((f) => f.rows.some((r) => r.key === rowKey));
  const target = draft[floorIndex];
  const lastCode = (slots: DraftSlot[]) =>
    [...slots].reverse().find((s) => s.roomCode !== null)?.roomCode;
  const seed =
    lastCode(target?.rows.find((r) => r.key === rowKey)?.slots ?? []) ??
    lastCode(target?.rows.flatMap((r) => r.slots) ?? []);
  return (
    (seed ? incrementCode(seed, used) : null) ??
    incrementCode(`${floorNumber(draft, Math.max(0, floorIndex))}00`, used)!
  );
}

function nextLabel(prefix: string, labels: string[]): string {
  const used = new Set(labels.map((l) => l.trim().toLowerCase()));
  let n = labels.length + 1;
  while (used.has(`${prefix} ${n}`.toLowerCase())) n += 1;
  return `${prefix} ${n}`;
}

/* ---------- templates ---------- */

export type LayoutTemplate =
  | { kind: 'single'; rooms: number }
  | { kind: 'double'; rooms: number }
  | { kind: 'multi'; floors: number; rooms: number }
  | { kind: 'custom' }
  | { kind: 'house' };

export function buildTemplate(template: LayoutTemplate): LayoutDraft {
  switch (template.kind) {
    case 'house':
      return [floor('Tầng 1', [row('Dãy 1', [room('Nguyên căn')])])];
    case 'custom':
      return [floor('Tầng 1', [row('Dãy 1')])];
    case 'single':
    case 'double': {
      const count = clamp(template.rooms, MAX_ROOMS_PER_BATCH);
      const rows = range(template.kind === 'single' ? 1 : 2).map((r) =>
        row(
          `Dãy ${r + 1}`,
          range(count).map((i) => room(String(101 + r * count + i)))
        )
      );
      return [floor('Tầng 1', rows)];
    }
    case 'multi': {
      const count = clamp(template.rooms, MAX_ROOMS_PER_BATCH);
      return range(clamp(template.floors, MAX_FLOORS)).map((f) =>
        floor(`Tầng ${f + 1}`, [
          row(
            'Dãy 1',
            range(count).map((i) => room(String((f + 1) * 100 + i + 1)))
          ),
        ])
      );
    }
  }
}

/* ---------- edits ---------- */

const mapRows = (draft: LayoutDraft, fn: (r: DraftRow) => DraftRow): LayoutDraft => {
  let changed = false;
  const next = draft.map((f) => {
    const rows = f.rows.map(fn);
    if (rows.every((r, i) => r === f.rows[i])) return f;
    changed = true;
    return { ...f, rows };
  });
  return changed ? next : draft;
};

const updateRow = (draft: LayoutDraft, rowKey: string, fn: (r: DraftRow) => DraftRow) =>
  mapRows(draft, (r) => (r.key === rowKey ? fn(r) : r));

export function findSlot(draft: LayoutDraft, slotKey: string) {
  for (const f of draft)
    for (const r of f.rows) {
      const index = r.slots.findIndex((s) => s.key === slotKey);
      if (index >= 0) return { floor: f, row: r, slot: r.slots[index], index };
    }
  return null;
}

export function addFloor(draft: LayoutDraft): LayoutDraft {
  return [
    ...draft,
    floor(
      nextLabel(
        'Tầng',
        draft.map((f) => f.label)
      ),
      [row('Dãy 1')]
    ),
  ];
}

export function addRow(draft: LayoutDraft, floorKey: string): LayoutDraft {
  return draft.map((f) =>
    f.key === floorKey
      ? {
          ...f,
          rows: [
            ...f.rows,
            row(
              nextLabel(
                'Dãy',
                f.rows.map((r) => r.label)
              )
            ),
          ],
        }
      : f
  );
}

export function addRooms(draft: LayoutDraft, rowKey: string, count = 1): LayoutDraft {
  let next = draft;
  for (let i = 0; i < clamp(count, MAX_ROOMS_PER_BATCH); i += 1) {
    const added = room(nextRoomCode(next, rowKey));
    next = updateRow(next, rowKey, (r) => ({ ...r, slots: [...r.slots, added] }));
  }
  return next;
}

export function addEmptyCell(draft: LayoutDraft, rowKey: string): LayoutDraft {
  return updateRow(draft, rowKey, (r) => ({ ...r, slots: [...r.slots, room(null)] }));
}

/** Why `code` cannot be used for this cell, or null when it can. */
export function roomCodeError(draft: LayoutDraft, slotKey: string, code: string): string | null {
  if (!code.trim()) return 'Vui lòng nhập mã phòng.';
  if (usedRoomCodes(draft, new Set([slotKey])).has(normalizeRoomCode(code)))
    return `Mã phòng "${code.trim()}" đã có.`;
  return null;
}

/** Invalid codes leave the draft unchanged; check roomCodeError first to explain why. */
export function setRoomCode(draft: LayoutDraft, slotKey: string, code: string): LayoutDraft {
  if (roomCodeError(draft, slotKey, code)) return draft;
  const value = code.trim();
  return mapRows(draft, (r) =>
    r.slots.some((s) => s.key === slotKey && s.roomCode !== value)
      ? { ...r, slots: r.slots.map((s) => (s.key === slotKey ? { ...s, roomCode: value } : s)) }
      : r
  );
}

/** Room <-> empty cell. A cell turned back into a room gets a suggested code. */
export function toggleEmptyCell(draft: LayoutDraft, slotKey: string): LayoutDraft {
  const found = findSlot(draft, slotKey);
  if (!found) return draft;
  const roomCode = found.slot.roomCode === null ? nextRoomCode(draft, found.row.key) : null;
  return updateRow(draft, found.row.key, (r) => ({
    ...r,
    slots: r.slots.map((s) => (s.key === slotKey ? { ...s, roomCode } : s)),
  }));
}

export function moveSlot(draft: LayoutDraft, slotKey: string, step: -1 | 1): LayoutDraft {
  const found = findSlot(draft, slotKey);
  const target = found ? found.index + step : -1;
  if (!found || target < 0 || target >= found.row.slots.length) return draft;
  return updateRow(draft, found.row.key, (r) => {
    const slots = [...r.slots];
    [slots[found.index], slots[target]] = [slots[target], slots[found.index]];
    return { ...r, slots };
  });
}

/** Moves the cell (keeping its id) to the bottom of another row. */
export function moveSlotToRow(draft: LayoutDraft, slotKey: string, rowKey: string): LayoutDraft {
  const found = findSlot(draft, slotKey);
  if (
    !found ||
    found.row.key === rowKey ||
    !draft.some((f) => f.rows.some((r) => r.key === rowKey))
  )
    return draft;
  return mapRows(draft, (r) => {
    if (r.key === found.row.key) return { ...r, slots: r.slots.filter((s) => s.key !== slotKey) };
    return r.key === rowKey ? { ...r, slots: [...r.slots, found.slot] } : r;
  });
}

export function removeSlot(draft: LayoutDraft, slotKey: string): LayoutDraft {
  return mapRows(draft, (r) =>
    r.slots.some((s) => s.key === slotKey)
      ? { ...r, slots: r.slots.filter((s) => s.key !== slotKey) }
      : r
  );
}

export function renameFloor(draft: LayoutDraft, floorKey: string, label: string): LayoutDraft {
  const value = label.trim();
  if (!value || !draft.some((f) => f.key === floorKey && f.label !== value)) return draft;
  return draft.map((f) => (f.key === floorKey ? { ...f, label: value } : f));
}

export function renameRow(draft: LayoutDraft, rowKey: string, label: string): LayoutDraft {
  const value = label.trim();
  if (!value) return draft;
  return updateRow(draft, rowKey, (r) => (r.label === value ? r : { ...r, label: value }));
}

export function removeFloor(draft: LayoutDraft, floorKey: string): LayoutDraft {
  return draft.some((f) => f.key === floorKey) ? draft.filter((f) => f.key !== floorKey) : draft;
}

export function removeRow(draft: LayoutDraft, rowKey: string): LayoutDraft {
  if (!draft.some((f) => f.rows.some((r) => r.key === rowKey))) return draft;
  return draft.map((f) =>
    f.rows.some((r) => r.key === rowKey)
      ? { ...f, rows: f.rows.filter((r) => r.key !== rowKey) }
      : f
  );
}

/**
 * Copies a floor right after the last one. All nodes are new (no ids); room codes move to the
 * new floor number ("101" -> "301") and never repeat an existing code.
 */
export function duplicateFloor(draft: LayoutDraft, floorKey: string): LayoutDraft {
  const sourceIndex = draft.findIndex((f) => f.key === floorKey);
  const source = draft[sourceIndex];
  if (!source) return draft;
  const sourceNo = floorNumber(draft, sourceIndex);
  const label = nextLabel(
    'Tầng',
    draft.map((f) => f.label)
  );
  const newNo = Number(/\d+$/.exec(label)![0]);
  const used = usedRoomCodes(draft);
  const floorPattern = new RegExp(`^(\\D*)${sourceNo}(\\d{2})$`);

  const copyCode = (code: string) => {
    const match = floorPattern.exec(code.trim());
    let next = match ? `${match[1]}${newNo}${match[2]}` : null;
    if (!next || used.has(normalizeRoomCode(next))) {
      next = incrementCode(next ?? code, used);
    }
    if (!next) {
      // A code without a number ("Kho") becomes "Kho 2", "Kho 3", ...
      next = incrementCode(`${code.trim()} 1`, used)!;
    }
    used.add(normalizeRoomCode(next));
    return next;
  };

  const rows = source.rows.map((r) =>
    row(
      r.label,
      r.slots.map((s) => room(s.roomCode === null ? null : copyCode(s.roomCode)))
    )
  );
  return [...draft, floor(label, rows)];
}

/**
 * Bulk re-code, in on-screen order (row by row, top to bottom).
 * One floor (`floorKey`): prefix + start, start+1, ... All floors: each floor is prefix + <floor>01, ...
 * Codes held by rooms outside the scope are skipped.
 */
export function recodeRooms(
  draft: LayoutDraft,
  options: { floorKey?: string; prefix?: string; start?: number }
): LayoutDraft {
  const { floorKey, prefix = '' } = options;
  const inScope = draft.filter((f) => !floorKey || f.key === floorKey);
  const scopeKeys = new Set(
    inScope.flatMap((f) => f.rows.flatMap((r) => r.slots.map((s) => s.key)))
  );
  const used = usedRoomCodes(draft, scopeKeys);
  const codes = new Map<string, string>();
  for (const f of inScope) {
    const no = floorNumber(draft, draft.indexOf(f));
    let n =
      floorKey && options.start !== undefined
        ? Math.max(0, Math.floor(options.start) || 0)
        : no * 100 + 1;
    for (const r of f.rows)
      for (const s of r.slots) {
        if (s.roomCode === null) continue;
        while (used.has(normalizeRoomCode(`${prefix.trim()}${n}`))) n += 1;
        const code = `${prefix.trim()}${n}`;
        used.add(normalizeRoomCode(code));
        codes.set(s.key, code);
      }
  }
  return mapRows(draft, (r) =>
    r.slots.some((s) => codes.has(s.key) && codes.get(s.key) !== s.roomCode)
      ? {
          ...r,
          slots: r.slots.map((s) => (codes.has(s.key) ? { ...s, roomCode: codes.get(s.key)! } : s)),
        }
      : r
  );
}

/* ---------- server <-> draft ---------- */

export function fromLayout(layout: BranchLayout): LayoutDraft {
  return (layout.floors ?? []).map((f) => ({
    key: f.id,
    id: f.id,
    label: f.label,
    rows: (f.rows ?? []).map((r) => ({
      key: r.id,
      id: r.id,
      label: r.label,
      slots: (r.slots ?? []).map((s) => ({ key: s.id, id: s.id, roomCode: s.roomCode ?? null })),
    })),
  }));
}

export function toSaveRequest(
  draft: LayoutDraft,
  expectedRevision: number
): SaveBranchLayoutRequest {
  const withId = (id: string | undefined) => (id ? { id } : {});
  return {
    expectedRevision,
    floors: draft.map((f) => ({
      ...withId(f.id),
      label: f.label.trim(),
      rows: f.rows.map((r) => ({
        ...withId(r.id),
        label: r.label.trim(),
        slots: r.slots.map((s) => ({
          ...withId(s.id),
          roomCode: s.roomCode === null ? null : s.roomCode.trim(),
        })),
      })),
    })),
  };
}

const treeText = (draft: LayoutDraft) => JSON.stringify(toSaveRequest(draft, 0).floors);

/** Same labels, order, codes and ids. */
export function sameLayout(a: LayoutDraft, b: LayoutDraft): boolean {
  return treeText(a) === treeText(b);
}

/**
 * Is `server` exactly what saving `sent` produces? Every id that was sent must be on the same
 * node, and every node sent without id must carry an id that `base` (the tree `sent` was edited
 * from) did not have. A tree that replaced an id we meant to keep, or reused one we meant to
 * drop, is not our save.
 */
export function isSavedCopy(server: LayoutDraft, sent: LayoutDraft, base: LayoutDraft): boolean {
  const known = new Set<unknown>(
    base.flatMap((f) => [f.id, ...f.rows.flatMap((r) => [r.id, ...r.slots.map((s) => s.id)])])
  );
  const comparable = JSON.stringify(toSaveRequest(server, 0).floors, (k, v) =>
    k === 'id' && !known.has(v) ? undefined : v
  );
  return comparable === treeText(sent);
}

/** Q12 limits (the server enforces the same). */
const MAX_ROWS = 10;
const MAX_ROW_SLOTS = 100;
const MAX_SLOTS = 1500;

/** Reasons the draft cannot be saved yet, in plain Vietnamese. */
export function validateDraft(draft: LayoutDraft): string[] {
  const errors: string[] = [];
  if (!draft.some((f) => f.rows.length > 0)) errors.push('Sơ đồ cần ít nhất một dãy.');
  if (countRooms(draft) === 0) errors.push('Sơ đồ cần ít nhất một phòng.');
  const seen = new Set<string>();
  let total = 0;
  for (const f of draft) {
    if (!f.label.trim()) errors.push('Có tầng chưa có tên.');
    if (f.rows.length > MAX_ROWS) errors.push(`${f.label} có quá ${MAX_ROWS} dãy. Mỗi tầng tối đa ${MAX_ROWS} dãy.`);
    for (const r of f.rows) {
      total += r.slots.length;
      if (r.slots.length > MAX_ROW_SLOTS)
        errors.push(`${f.label}, ${r.label} có quá ${MAX_ROW_SLOTS} ô. Mỗi dãy tối đa ${MAX_ROW_SLOTS} ô.`);
      if (!r.label.trim()) errors.push(`${f.label} có dãy chưa có tên.`);
      for (const s of r.slots) {
        if (s.roomCode === null) continue;
        const code = normalizeRoomCode(s.roomCode);
        if (!code) errors.push(`${f.label}, ${r.label} có phòng chưa có mã.`);
        else if (seen.has(code)) errors.push(`Mã phòng "${s.roomCode.trim()}" bị trùng.`);
        seen.add(code);
      }
    }
  }
  if (total > MAX_SLOTS) errors.push(`Sơ đồ có quá ${MAX_SLOTS} ô. Tối đa ${MAX_SLOTS} ô cho toàn sơ đồ.`);
  return errors;
}

/* ---------- undo ---------- */

export interface DraftHistory {
  past: LayoutDraft[];
  present: LayoutDraft;
}

export const createHistory = (present: LayoutDraft): DraftHistory => ({ past: [], present });

export function applyEdit(history: DraftHistory, next: LayoutDraft): DraftHistory {
  if (next === history.present) return history;
  return { past: [...history.past, history.present].slice(-MAX_UNDO), present: next };
}

export function undoEdit(history: DraftHistory): DraftHistory {
  if (history.past.length === 0) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1] };
}
