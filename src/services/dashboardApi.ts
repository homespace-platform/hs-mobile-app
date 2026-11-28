import axiosClient from '@/lib/axios-client';
import { parseDashboardResponse, type DashboardMoney as Money } from '@/lib/dashboard-summary';
import type { ApiResponse } from '@/types/api';

export type SummaryAction = {
  key: string;
  type: string;
  contextLabel: string | null;
  dueAt: string | null;
  clock: 'BILLING' | 'REAL';
  priority: string;
  href: string | null;
};
export type SummaryComplaint = {
  id: string;
  contractNumber: string | null;
  category: string;
  status: string;
  respondBy: string | null;
  responseDueFor: string;
  href: string | null;
};
type Pending = { count: number; vnd: Money; nextDueAt: string | null };
export type LandlordSummary = {
  billingNow: string;
  realNow: string;
  month: string;
  errors: Record<string, boolean>;
  setup: { hasReceivingAccount: boolean } | null;
  rooms: {
    total: number;
    occupied: number;
    vacant: number;
    reserved: number;
    other: number;
  } | null;
  listings: {
    published: number;
    pendingReview: number;
    draft: number;
    oldestPendingSince: string | null;
    unplaced: { listings: number; contracts: number };
    needsFix: {
      rejected: number;
      violation: number;
      hidden: number;
      items: { id: string; title: string; status: string; href: string }[];
    };
  } | null;
  revenue: {
    receivedVnd: Money;
    refundedVnd: Money;
    expectedVnd: Money;
    overdueCount: number;
    overdueVnd: Money;
    depositReceivedVnd: Money;
    awaitingConfirm: Pending;
    rejected: Pending;
    refundsOwed: Pending;
    lateFromPreviousVnd: Money;
    lateFeeVnd: Money;
    rolledOverVnd: Money;
    receiptPdfIssues: number;
  } | null;
  todo: { total: number; urgent: number; items: SummaryAction[] } | null;
  contracts: {
    byStatus: Record<string, number>;
    closures: {
      byStatus: Record<string, number>;
      endedNotClosed: number;
      refundVnd: Money;
      nextRefundDueAt: string | null;
    };
    signatureIssues: { failed: number; pendingConfirm: number };
    depositAgreements: { waitingSign: number; nextDueAt: string | null };
  } | null;
  expiringContracts:
    | {
        contractId: string;
        contractNumber: string;
        roomCode: string;
        endDateExclusive: string;
        href: string;
      }[]
    | null;
  appointments:
    | {
        id: string;
        at: string;
        listingTitle: string;
        renterName: string;
        status: string;
        href: string;
      }[]
    | null;
  expiringListings:
    | {
        id: string;
        title: string;
        expiresAt: string;
        daysRemaining: number;
        href: string;
        noLeads: boolean;
      }[]
    | null;
  membership: {
    tier: string;
    remainingUses: number;
    reservedUses: number;
    expiresAt: string | null;
    unlimited: boolean;
    addonRemaining: number;
    pendingOrders: number;
    failedOrders30d: number;
    paidVndMonth: Money;
  } | null;
  competing: { listingId: string; title: string; pendingCount: number; href: string }[] | null;
  holds:
    | {
        rentalRequestId: string;
        listingTitle: string;
        holdExpiresAt: string | null;
        waitingFor: string;
        href: string;
      }[]
    | null;
  complaints: { openCount: number; dueFromMeCount: number; items: SummaryComplaint[] } | null;
};
type Payable = {
  paymentId: string;
  contractNumber: string | null;
  listingTitle: string | null;
  amount: Money;
  dueAt: string | null;
  clock: 'BILLING' | 'REAL';
  overdue: boolean;
  href: string;
};
export type TenantSummary = {
  billingNow: string;
  realNow: string;
  timezone: string;
  setup: { onboarded: boolean };
  leases: {
    activeCount: number;
    items: {
      contractId: string;
      contractNumber: string;
      listingTitle: string;
      startsOn: string;
      endExclusive: string;
      monthlyRent: Money;
      href: string;
    }[];
  };
  payables: {
    overdueCount: number;
    overdueAmount: Money;
    dueSoonAmount: Money;
    items: Payable[];
    awaiting: {
      count: number;
      amount: Money;
      items: { paymentId: string; amount: Money; confirmationDueAt: string | null; href: string }[];
    };
    refundsIncoming: {
      count: number;
      amount: Money;
      items: { paymentId: string; amount: Money; dueAt: string | null; href: string }[];
    };
  };
  tasks: { total: number; urgentCount: number; items: SummaryAction[] };
  holds: {
    rentalRequestId: string;
    listingTitle: string;
    holdExpiresAt: string;
    critical: boolean;
    amountDue: Money;
    href: string;
  }[];
  visits: {
    upcomingCount: number;
    items: {
      id: string;
      listingTitle: string;
      appointmentDate: string;
      startTime: string;
      status: string;
    }[];
  };
  requests: {
    counts: Record<string, number>;
    open: {
      id: string;
      listingTitle: string;
      status: string;
      respondBy: string | null;
      href: string;
    }[];
  };
  spending: {
    total: Money;
    totalExcludingDeposit: Money;
    total12m: Money;
    total12mExcludingDeposit: Money;
    months: { month: string; total: Money; byGroup: Record<string, Money> }[];
    receiptPdfIssues: number;
  };
  deposits: {
    heldTotal: Money;
    items: {
      contractId: string;
      contractNumber: string;
      amount: Money;
      status: string;
      closure: { status: string; refundAmount: Money; refundDueAt: string | null } | null;
      href: string;
    }[];
  };
  waiting: {
    count: number;
    items: (SummaryAction & {
      contractId: string;
      contractNumber: string;
      respondBy: string | null;
    })[];
  };
  complaints: { openCount: number; dueFromMeCount: number; items: SummaryComplaint[] };
  saved: { total: number; available: number; unavailable: number };
};
export type LandlordAnalytics = {
  billingNow: string;
  from: string;
  to: string;
  receiptsSince: string | null;
  revenue: {
    month: string;
    receivedVnd: Money;
    refundedVnd: Money;
    netVnd: Money;
    dueVnd: Money;
    dueCollectedVnd: Money;
    lateCollectedVnd: Money;
    lateFeeVnd: Money;
    rolledOverVnd: Money;
    membershipFeeVnd: Money;
  }[];
  occupancy: {
    month: string;
    rooms: number;
    occupiedRoomDays: number;
    roomDays: number;
    rate: number | string | null;
  }[];
  receivables: {
    totalVnd: Money;
    count: number;
    buckets: { key: string; count: number; vnd: Money }[];
    top: {
      paymentId: string;
      contractNumber: string;
      amountVnd: Money;
      dueAt: string;
      daysLate: number;
      href: string;
    }[];
  };
  listings: {
    viewsSince: string | null;
    page: number;
    size: number;
    total: number;
    items: {
      id: string;
      title: string;
      status: string;
      viewsInRange: number | null;
      viewCountTotal: number;
      appointments: number;
      requests: number;
      contracts: number;
      favorites: number;
      noLeads: boolean;
    }[];
  };
  funnel: {
    views: { value: number; cumulative: boolean; since: string | null };
    appointments: number;
    requests: number;
    contracts: number;
  };
};

async function read<T>(
  path: string,
  signal?: AbortSignal,
  params?: Record<string, string | number>
) {
  const response = await axiosClient.get<ApiResponse<T>>(path, {
    signal,
    params,
    transformResponse: [parseDashboardResponse],
  });
  if (!response.data?.result) throw new Error('Máy chủ chưa trả dữ liệu tổng quan.');
  return response.data.result;
}
export const getLandlordSummary = (signal?: AbortSignal) =>
  read<LandlordSummary>('/api/v1/dashboard/landlord/summary', signal);
export const getTenantSummary = (signal?: AbortSignal) =>
  read<TenantSummary>('/api/v1/dashboard/tenant/summary', signal);
export const getLandlordAnalytics = (
  signal?: AbortSignal,
  params?: Record<string, string | number>
) => read<LandlordAnalytics>('/api/v1/dashboard/analytics', signal, params);
