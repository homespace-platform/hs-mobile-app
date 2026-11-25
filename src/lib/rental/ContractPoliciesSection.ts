// Port of the pure parts of hs-web-app components/contract/detail/ContractPoliciesSection.tsx:15-21, :58-70.
import { numberVi } from '@/lib/rental/format';
import type { PolicySnapshot } from '@/types/rental/contract.type';

export const formatVnd = (amount: number) => `${numberVi(amount)} đ`;

export interface DraftPolicyFields {
  feeMode: NonNullable<PolicySnapshot['latePaymentFeeMode']>;
  feeAmount: string;
  additionalTerms?: string;
}

/** Late fee shown for `lateDays`: at most 5 chargeable days after the grace days, capped when a cap exists. */
export function feeAfterDays(
  policies: PolicySnapshot | Record<string, unknown> | null | undefined,
  lateDays: number
) {
  const p: Record<string, unknown> = (policies || {}) as Record<string, unknown>;
  const lateMode = p.latePaymentFeeMode || 'NONE';
  const savedFeeAmount = Number(p.latePaymentFeeAmount || 0);
  const savedGraceDays = Number(p.latePaymentFeeGraceDays || 0);
  const savedFeeCap = Number(p.latePaymentFeeCap || 0);
  const chargeableDays = Math.min(5, Math.max(0, lateDays - savedGraceDays));
  const fee =
    lateMode === 'FIXED_PER_DAY'
      ? savedFeeAmount * chargeableDays
      : chargeableDays > 0
        ? savedFeeAmount
        : 0;
  return savedFeeCap > 0 ? Math.min(fee, savedFeeCap) : fee;
}
