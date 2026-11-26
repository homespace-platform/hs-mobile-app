// Web hooks/useMembershipPricing: plans, my membership and the upgrade quotes, shared by the
// membership screen and Home.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getMembershipErrorMessage,
  getPlanCardState,
  isMembershipDowngradeError,
  isUnlimitedMembership,
  mergeMembershipPlans,
  type MembershipPlanInfo,
} from '@/lib/membership';
import {
  getMembershipPlans,
  getMembershipQuote,
  getMyMembership,
  type MembershipQuote,
  type MembershipView,
} from '@/services/membershipApi';

const PAID_TIERS = ['STARTER', 'PRO', 'BUSINESS'] as const;

export function useMembershipPricing(role?: string | null) {
  const [plans, setPlans] = useState<MembershipPlanInfo[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipView | null>(null);
  const [quotes, setQuotes] = useState<Record<string, MembershipQuote>>({});
  const [refusals, setRefusals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setPlansError(null);
    const [planResult, meResult] = await Promise.allSettled([
      getMembershipPlans(),
      getMyMembership(),
    ]);
    if (request !== latest.current) return;
    // A failed reload keeps what is already shown.
    if (planResult.status === 'fulfilled') setPlans(mergeMembershipPlans(planResult.value));
    else
      setPlansError(
        getMembershipErrorMessage(planResult.reason, 'Không tải được bảng giá gói hội viên.')
      );
    if (meResult.status === 'fulfilled') setMembership(meResult.value);

    const nextQuotes: Record<string, MembershipQuote> = {};
    const nextRefusals: Record<string, string> = {};
    await Promise.all(
      PAID_TIERS.map(async (tier) => {
        try {
          const quote = await getMembershipQuote(tier);
          if (quote) nextQuotes[tier] = quote;
        } catch (error) {
          if (isMembershipDowngradeError(error))
            nextRefusals[tier] = getMembershipErrorMessage(error);
        }
      })
    );
    if (request !== latest.current) return;
    setQuotes(nextQuotes);
    setRefusals(nextRefusals);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      latest.current++;
    };
  }, [reload]);

  const unlimited = isUnlimitedMembership(membership, role);
  const cardState = (plan: MembershipPlanInfo) =>
    getPlanCardState(plan, {
      membership,
      unlimited,
      quote: quotes[plan.code],
      refusal: refusals[plan.code],
    });

  return { plans, plansError, membership, unlimited, loading, reload, cardState };
}
