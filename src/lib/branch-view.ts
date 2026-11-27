/**
 * What the status view of the floor map shows: cell lines, sheet items, legend counts and matches.
 * The wording ports hs-web-app components/branch/BranchOverviewLayers.tsx. States, order, counts of a
 * cell and deadlines are the server's; nothing here decides them again.
 */
import { formatDay } from '@/lib/branch-assignment';
import { listingStatusLabel } from '@/lib/listing-manage';
import {
  LAYER_STATUS_LABEL,
  confirmationCountdown,
  expiryText,
  formatInstant,
  paymentKindLabel,
  roomLayerStatus,
  roomLegendKey,
  leaseChipStatus,
  roomMatches,
  sortExpiries,
  statusLabel,
  targetHref,
  type BranchOverview,
  type OverviewLayer,
  type OverviewMeter,
  type OverviewPayment,
  type OverviewRoom,
  type OverviewTarget,
} from '@/lib/branch-overview';
import type { LayoutDraft } from '@/types/branch-layout';

type Times = Pick<BranchOverview, 'billingNow' | 'realNow'>;

/** One thing in a cell: a row of the room sheet that leads to the screen where it is handled. */
export interface ViewEntry {
  key: string;
  layer: OverviewLayer;
  status: string;
  title: string;
  lines: string[];
  /** null = the server gave nothing that can be opened. */
  target: OverviewTarget | null;
}

/** Wording only; lib/branch-target decides where to go from the href. */
const OPEN_LABEL: Record<string, string> = {
  CONTRACT: 'Mở hợp đồng',
  INVOICE: 'Mở hóa đơn',
  PAYMENT: 'Mở khoản tiền',
  AMENDMENT: 'Mở phụ lục',
  RENTAL_REQUEST: 'Mở hồ sơ thuê',
  APPOINTMENT: 'Mở lịch xem',
  LISTING: 'Mở tin đăng',
};
export const openLabel = (target: OverviewTarget) => OPEN_LABEL[target.kind] ?? 'Mở để xem';

const openable = (target: OverviewTarget) => (targetHref(target) ? target : null);
const texts = (lines: (string | null)[]) => lines.filter((line): line is string => !!line);

const dueText = (payment: OverviewPayment) =>
  `${payment.status === 'UNISSUED' ? 'Hạn dự kiến' : 'Hạn'} ${formatInstant(payment.dueAt)}`;
const countdownOf = (payment: OverviewPayment, times: Times, elapsedMs: number) =>
  payment.status === 'PENDING_CONFIRMATION'
    ? confirmationCountdown(payment, times, elapsedMs)
    : null;

const meterLines = (meter: OverviewMeter) =>
  texts([
    `Ngày ghi ${formatDay(meter.meterDate)}`,
    meter.status === 'RECORDED' ? null : `Hạn ghi ${formatInstant(meter.deadlineAt)}`,
  ]);

const paymentEntry = (payment: OverviewPayment, times: Times, elapsedMs: number): ViewEntry => ({
  key: payment.id,
  layer: 'payments',
  status: payment.status,
  title: `${statusLabel('payments', payment.status)} · ${paymentKindLabel(payment.kind)}`,
  lines: texts([dueText(payment), countdownOf(payment, times, elapsedMs)]),
  target: openable(payment.target),
});

/** "Trống · <listing status>" for a vacant room with a listing; everything else is the plain word. */
export const roomLabel = (room: OverviewRoom) =>
  room.status === 'VACANT' && typeof room.listingStatus === 'string'
    ? `${statusLabel('rooms', room.status)} · ${listingStatusLabel(room.listingStatus)}`
    : statusLabel('rooms', room.status);

/** The label of a map cell on the current layer. */
export function cellLabel(room: OverviewRoom, layer: OverviewLayer) {
  if (layer === 'rooms') return roomLabel(room);
  const status = roomLayerStatus(room, layer);
  if (layer !== 'contracts') return statusLabel(layer, status);
  const [first] = sortExpiries(room.contracts ?? []);
  // No lease row: an older server, so an occupied room is only known to be past 60 days.
  return first
    ? expiryText(first)
    : status === 'LONG'
      ? 'Còn hạn trên 60 ngày'
      : statusLabel(layer, status);
}

/** "Hợp đồng: <expiry>" lines of the room sheet, most urgent first. */
export const contractLines = (room: OverviewRoom) =>
  sortExpiries(room.contracts ?? []).map((expiry) => `Hợp đồng: ${expiryText(expiry)}`);

/** The current stay (or listing) and the next one. A ROOM target is the cell menu, not a page. */
function stayEntries(room: OverviewRoom): ViewEntry[] {
  const entries: ViewEntry[] = [];
  const { target, nextStay: next } = room;
  if (target && target.kind !== 'ROOM' && targetHref(target)) {
    entries.push({
      key: 'current',
      layer: 'rooms',
      status: room.status,
      title: roomLabel(room),
      lines: texts([room.tenantName]),
      target,
    });
  }
  if (next && targetHref(next.target)) {
    entries.push({
      key: 'next',
      layer: 'rooms',
      status: 'MOVING_IN',
      title: 'Sắp vào',
      lines: texts([next.tenantName, `Ngày vào ${formatDay(next.moveInDate)}`]),
      target: next.target,
    });
  }
  return entries;
}

/** Everything in one cell, in the server's order. Call only after `layerReady(overview, layer)`. */
export function layerEntries(
  room: OverviewRoom,
  layer: OverviewLayer,
  times: Times,
  elapsedMs: number
): ViewEntry[] {
  if (layer === 'rooms') return stayEntries(room);
  if (layer === 'payments')
    return room.payments.items.map((payment) => paymentEntry(payment, times, elapsedMs));
  if (layer === 'meters')
    return (room.meters ?? []).map((meter) => ({
      key: `${meter.contractId}:${meter.periodIndex}`,
      layer,
      status: meter.status,
      title: `${statusLabel(layer, meter.status)} · Chi phí tháng ${meter.periodIndex + 1}`,
      lines: meterLines(meter),
      target: openable(meter.target),
    }));
  return sortExpiries(room.contracts ?? []).map((expiry) => ({
    key: expiry.contractId,
    layer,
    status: expiry.status,
    title: expiryText(expiry),
    lines: [statusLabel(layer, expiry.status)],
    target: openable(expiry.target),
  }));
}

/** The few lines inside a cell, about its first (most urgent) item (contracts: the label already says it, the lines count the others); the sheet has all of them. */
export function cellLines(
  room: OverviewRoom,
  layer: OverviewLayer,
  times: Times,
  elapsedMs: number
): string[] {
  if (layer === 'rooms') {
    const next = room.nextStay;
    return texts([
      room.tenantName,
      next ? `Sắp vào ${formatDay(next.moveInDate)}: ${next.tenantName || 'chưa có tên'}` : null,
    ]);
  }
  if (layer === 'payments') {
    const first = room.payments.items[0];
    return first
      ? texts([
          `${room.payments.count} khoản`,
          dueText(first),
          countdownOf(first, times, elapsedMs),
        ])
      : [];
  }
  if (layer === 'contracts') {
    const count = room.contracts?.length ?? 0;
    return count > 1 ? [`+${count - 1} hợp đồng khác`] : [];
  }
  const meters = room.meters ?? [];
  if (!meters.length) return [];
  const lines = meterLines(meters[0]);
  return meters.length > 1 ? [...lines, `${meters.length} mục`] : lines;
}

export const unplacedEntries = (overview: BranchOverview, elapsedMs: number) =>
  overview.unplacedPayments.map((payment) => paymentEntry(payment, overview, elapsedMs));

/**
 * Search and legend highlight over every floor. The legend counts cells by their main status; when the
 * layer has no data the caller hides the legend and passes no highlight (search still works).
 */
export function mapSummary(
  floors: LayoutDraft,
  rooms: ReadonlyMap<string, OverviewRoom>,
  layer: OverviewLayer,
  query: string,
  highlight: string | null
) {
  const filtering = query.trim() !== '' || highlight !== null;
  const counts = new Map<string, number>();
  /** Slot keys. */
  const matched = new Set<string>();
  const perFloor = new Map<string, number>();
  const leaseStatuses: string[] = [];
  for (const floor of floors) {
    let onFloor = 0;
    for (const row of floor.rows)
      for (const slot of row.slots) {
        if (slot.roomCode === null) continue;
        const room = rooms.get(slot.id ?? '');
        const status = room ? roomLegendKey(room, layer) : null;
        if (status) counts.set(status, (counts.get(status) ?? 0) + 1);
        if (room && layer === 'contracts' && status === 'HAS_LEASE')
          leaseStatuses.push(roomLayerStatus(room, layer));
        if (
          filtering &&
          (!query.trim() || roomMatches(slot.roomCode, room, query)) &&
          (!highlight || status === highlight)
        ) {
          matched.add(slot.key);
          onFloor += 1;
        }
      }
    perFloor.set(floor.key, onFloor);
  }
  return { filtering, counts, matched, perFloor, leaseStatus: leaseChipStatus(leaseStatuses) };
}

/** Legend order (most urgent first): statuses that have rooms, plus the highlighted one. */
export const legendItems = (
  layer: OverviewLayer,
  counts: ReadonlyMap<string, number>,
  highlight: string | null
) =>
  Object.entries(LAYER_STATUS_LABEL[layer])
    .map(([status, label]) => ({ status, label, count: counts.get(status) ?? 0 }))
    .filter((item) => item.count > 0 || item.status === highlight);

const COLUMN_GAP = 8;

/**
 * Width of one row (a column on screen). null = the columns share the width; a number = fixed columns
 * that scroll sideways inside the map.
 */
export function columnWidth(columns: number, fontScale: number, available: number): number | null {
  if (columns <= 1) return null;
  const width = Math.round(136 * Math.min(Math.max(fontScale, 1), 1.6));
  if (fontScale >= 1.3)
    return columns * width + (columns - 1) * COLUMN_GAP <= available ? null : width;
  return columns === 2 ? null : width;
}
