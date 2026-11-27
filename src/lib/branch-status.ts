/**
 * One place for how a branch status looks: icon + tone; the Vietnamese words are in
 * lib/branch-overview. Colour is never the only signal. Draw a pill with components/branch/StatusTag,
 * or use BRANCH_TONES for a map cell. No runtime imports.
 */
import type {
  OverviewExpiry,
  OverviewLayer,
  OverviewMeter,
  PaymentStatus,
  RoomStatus,
  WorkPriority,
} from '@/lib/branch-overview';

export type BranchTone = 'success' | 'pending' | 'info' | 'warning' | 'danger' | 'neutral' | 'muted' | 'off';

/** RN does not inherit text colour, so box and text classes are separate. */
export const BRANCH_TONES: Record<BranchTone, { box: string; text: string }> = {
  success: { box: 'border-success bg-success-soft', text: 'text-success' },
  pending: { box: 'border-pending bg-pending-soft', text: 'text-pending' },
  info: { box: 'border-primary bg-primary-soft', text: 'text-primary' },
  warning: { box: 'border-warning bg-warning-soft', text: 'text-warning' },
  danger: { box: 'border-danger bg-danger-soft', text: 'text-danger' },
  neutral: { box: 'border-border-strong bg-surface', text: 'text-foreground' },
  muted: { box: 'border-border bg-background', text: 'text-muted-foreground' },
  off: { box: 'border-dashed border-border-strong bg-muted', text: 'text-secondary' },
};

export interface BranchLook {
  /** Ionicons name. */
  icon:
    | 'alarm-outline'
    | 'alert-circle-outline'
    | 'ban-outline'
    | 'bookmark-outline'
    | 'calendar-outline'
    | 'checkmark-circle-outline'
    | 'construct-outline'
    | 'document-text-outline'
    | 'ellipse-outline'
    | 'ellipsis-horizontal-circle-outline'
    | 'hourglass-outline'
    | 'key-outline'
    | 'log-in-outline'
    | 'megaphone-outline'
    | 'remove-outline'
    | 'time-outline'
    | 'unlink-outline';
  tone: BranchTone;
}

const look = (icon: BranchLook['icon'], tone: BranchTone): BranchLook => ({ icon, tone });
const NONE = look('remove-outline', 'neutral');

const ROOM_LOOK: Record<RoomStatus, BranchLook> = {
  VACANT: look('ellipse-outline', 'neutral'),
  ADVERTISED: look('megaphone-outline', 'info'),
  RESERVED: look('bookmark-outline', 'warning'),
  OCCUPIED: look('key-outline', 'success'),
  MOVING_IN: look('log-in-outline', 'pending'),
  EXTERNAL_RENT: look('ban-outline', 'off'),
  REPAIR: look('construct-outline', 'warning'),
  UNLINKED: look('unlink-outline', 'muted'),
};
/** Colours fixed by concept section 5. */
const PAYMENT_LOOK: Record<PaymentStatus, BranchLook> = {
  OVERDUE: look('alert-circle-outline', 'danger'),
  PENDING_CONFIRMATION: look('hourglass-outline', 'pending'),
  DUE_SOON: look('alarm-outline', 'warning'),
  NOT_DUE: look('calendar-outline', 'info'),
  UNISSUED: look('ellipsis-horizontal-circle-outline', 'off'),
  PAID: look('checkmark-circle-outline', 'success'),
  NONE,
};
const METER_LOOK: Record<OverviewMeter['status'] | 'NONE', BranchLook> = {
  TODAY: look('alert-circle-outline', 'danger'),
  UPCOMING: look('calendar-outline', 'warning'),
  RECORDED: look('checkmark-circle-outline', 'success'),
  NONE,
};
const EXPIRY_LOOK: Record<OverviewExpiry['status'] | 'LONG' | 'NO_LEASE', BranchLook> = {
  WITHIN_30: look('alarm-outline', 'danger'),
  WITHIN_60: look('calendar-outline', 'warning'),
  LONG: NONE,
  NO_LEASE: NONE,
};

const LAYER_LOOK: Record<OverviewLayer, Record<string, BranchLook>> = {
  rooms: ROOM_LOOK,
  payments: PAYMENT_LOOK,
  meters: METER_LOOK,
  contracts: EXPIRY_LOOK,
};

export const layerLook = (layer: OverviewLayer, status: string): BranchLook =>
  LAYER_LOOK[layer][status] ?? look('document-text-outline', 'neutral');

/** Words: PRIORITY_LABEL in lib/branch-overview. */
export const PRIORITY_LOOK: Record<WorkPriority, BranchLook> = {
  URGENT: look('alert-circle-outline', 'danger'),
  SOON: look('time-outline', 'warning'),
  NORMAL: look('ellipse-outline', 'neutral'),
};
