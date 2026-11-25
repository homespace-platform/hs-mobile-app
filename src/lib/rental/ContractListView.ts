// Port of the rules in hs-web-app components/contract/ContractListView.tsx:18-63.
import {
  contractDetailPath,
  invoiceDetailPath,
  type ContractRoute,
} from '@/lib/rental/contract-routes';
import type { ContractResponse } from '@/types/rental/contract.type';

export type Perspective = 'landlord' | 'tenant';
export type Kind = 'LEASE' | 'DEPOSIT';
export type Group = 'ALL' | 'MINE' | 'WAITING' | 'RUNNING' | 'ENDED';
export type Turn = 'mine' | 'waiting' | 'running' | 'ended';

/** Sign-state of the contract seen from the viewer: who has to move next. */
export function turnOf(c: Pick<ContractResponse, 'status'>, perspective: Perspective): Turn {
  const landlord = perspective === 'landlord';
  switch (c.status) {
    case 'LANDLORD_SIGNATURE_PENDING':
      return landlord ? 'mine' : 'waiting';
    case 'TENANT_SIGNATURE_PENDING':
      return landlord ? 'waiting' : 'mine';
    // Deposit agreements are born ready (DRAFT = landlord signs next); a lease draft is the landlord's to finish.
    case 'DRAFT':
      return landlord ? 'mine' : 'waiting';
    case 'PENDING_REVIEW':
      return landlord ? 'waiting' : 'mine';
    case 'ACTIVE':
      return 'running';
    default:
      return 'ended';
  }
}

export const SIGN_STATUSES = ['LANDLORD_SIGNATURE_PENDING', 'TENANT_SIGNATURE_PENDING'];

export function primaryAction(
  c: Pick<ContractResponse, 'id' | 'status' | 'agreementKind'>,
  perspective: Perspective,
  turn: Turn
): { label: string; href: ContractRoute; detail: boolean } {
  const detail = contractDetailPath(perspective, c.id);
  if (turn === 'mine' && SIGN_STATUSES.includes(c.status))
    return { label: 'Ký số', href: { ...detail, tab: 'sign' }, detail: false };
  if (
    c.agreementKind !== 'DEPOSIT' &&
    ['ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED'].includes(c.status)
  ) {
    return { label: 'Xem hóa đơn', href: invoiceDetailPath(c.id), detail: false };
  }
  return { label: 'Mở hồ sơ', href: detail, detail: true };
}

export function hint(
  c: Pick<ContractResponse, 'status' | 'agreementKind'>,
  perspective: Perspective,
  turn: Turn
): string | null {
  const other = perspective === 'landlord' ? 'người thuê' : 'chủ nhà';
  if (turn === 'mine') {
    if (SIGN_STATUSES.includes(c.status)) return 'Đến lượt bạn ký số.';
    return c.status === 'DRAFT'
      ? 'Bản nháp đang chờ bạn hoàn thiện.'
      : 'Cần bạn xem lại và xác nhận.';
  }
  if (turn === 'waiting')
    return c.status === 'DRAFT' && perspective === 'tenant' && c.agreementKind !== 'DEPOSIT'
      ? null
      : `Đang chờ ${other}.`;
  return null;
}

export const GROUPS: { id: Exclude<Group, 'ALL'>; label: (kind: Kind) => string }[] = [
  { id: 'MINE', label: () => 'Cần tôi xử lý' },
  { id: 'WAITING', label: () => 'Đang chờ bên kia' },
  { id: 'RUNNING', label: (kind) => (kind === 'DEPOSIT' ? 'Đã ký đủ' : 'Đang thuê') },
  { id: 'ENDED', label: () => 'Đã kết thúc' },
];

export const groupOf = (turn: Turn): Exclude<Group, 'ALL'> =>
  turn === 'mine'
    ? 'MINE'
    : turn === 'waiting'
      ? 'WAITING'
      : turn === 'running'
        ? 'RUNNING'
        : 'ENDED';
