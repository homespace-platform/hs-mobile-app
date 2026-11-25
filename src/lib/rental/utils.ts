// Port of the pure parts of hs-web-app components/contract/detail/utils.tsx (FieldRow and
// ContractSnapshotReadOnly are UI and belong to the screen components).
import { numberVi } from '@/lib/rental/format';

export function str(v: unknown): string {
  if (v == null) return '—';
  const s = String(v).trim();
  return s === '' ? '—' : s;
}

export function isZeroDeposit(value: unknown): boolean {
  return /^0(?:\.0+)?(?:\s+VN[ĐD])?$/u.test(String(value ?? '').trim());
}

export function formatMoney(value: unknown): string {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? `${numberVi(amount)} VNĐ` : String(value);
}
