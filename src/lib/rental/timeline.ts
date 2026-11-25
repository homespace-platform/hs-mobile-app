// Port of hs-web-app components/contract/page/timeline.ts (verbatim; only import paths changed).
/** Milestones of a lease for the overview tab, from fields every contract response already has. */
export interface Milestone {
  label: string;
  done: boolean;
  current: boolean;
  at?: string | null;
}

interface Source {
  status: string;
  paymentStatus?: string | null;
  paidAt?: string | null;
  landlordConfirmedAt?: string | null;
  signedAt?: string | null;
  createdAt?: string | null;
}

const ENDED = ['EXPIRED', 'CLOSED', 'TERMINATED'];

export function leaseTimeline(c: Source, depositSigned?: boolean): Milestone[] {
  const paid = c.paymentStatus === 'PAID' || c.paymentStatus === 'PAID_MOCK';
  const effective = c.status === 'ACTIVE' || ENDED.includes(c.status);
  const steps: Omit<Milestone, 'current'>[] = [
    ...(depositSigned === undefined ? [] : [{ label: 'Hợp đồng cọc ký đủ', done: depositSigned }]),
    { label: 'Soạn hợp đồng thuê', done: Boolean(c.createdAt) || effective, at: c.createdAt },
    {
      label: 'Chủ nhà xác nhận',
      done: Boolean(c.landlordConfirmedAt) || effective,
      at: c.landlordConfirmedAt,
    },
    { label: 'Thanh toán ban đầu', done: paid || effective, at: c.paidAt },
    { label: 'Hai bên ký đủ', done: Boolean(c.signedAt) || effective, at: c.signedAt },
    { label: 'Đang hiệu lực', done: effective },
    ...(ENDED.includes(c.status)
      ? [
          {
            label:
              c.status === 'TERMINATED'
                ? 'Đã chấm dứt'
                : c.status === 'CLOSED'
                  ? 'Đã kết thúc'
                  : 'Hết thời hạn thuê',
            done: true,
          },
        ]
      : []),
  ];
  const firstOpen = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ ...s, current: i === firstOpen }));
}
