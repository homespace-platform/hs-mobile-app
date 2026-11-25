// Port of the rental part of hs-web-app components/notification/NotificationTransport.tsx: which socket/push
// signal invalidates what. Pure (no React Native), see tests/rental-nav.test.cjs.

export type RentalSyncEvent =
  | { type: 'rental-request-changed'; requestId?: string }
  /** Web window event "homespace:complaint-changed"; `requestId` is the rental request. */
  | { type: 'complaint-changed'; requestId?: string }
  | { type: 'payment-changed'; paymentId?: string }
  | { type: 'invoice-changed'; contractId?: string; invoiceId?: string }
  | { type: 'agreement-changed'; agreementId?: string };

// The type lists of hs-web-app services/notification.service.ts (the test compares them with the web source).
const words = (list: string) => new Set(list.trim().split(/\s+/));
export const INVOICE_TYPES = words(`
  INVOICE_METER_REMINDER INVOICE_PAYMENT_REMINDER INVOICE_DRAFT_READY INVOICE_ISSUED INVOICE_OVERDUE
  INVOICE_AMOUNT_UPDATED INVOICE_EXTENSION_REQUESTED INVOICE_EXTENSION_APPROVED INVOICE_EXTENSION_REJECTED
  INVOICE_EXTENSION_EXPIRED INVOICE_OVERDUE_ACTION_RECORDED INVOICE_OVERDUE_ACTION_ACKNOWLEDGED
  INVOICE_DEFERRED INVOICE_ROLLED_OVER INVOICE_OVERDUE_ACTION_REQUIRED
`);
export const ROUTED_PAYMENT_TYPES = words(`
  PAYMENT_DUE_SOON PAYMENT_REQUEST_CREATED PAYMENT_OBLIGATION_OVERDUE PAYMENT_TRANSFER_REPORTED
  PAYMENT_RECEIPT_CONFIRMED PAYMENT_RECEIPT_REJECTED PAYMENT_REFUND_AUTO_CONFIRM_SOON
  PAYMENT_RECEIPT_AUTO_CONFIRM_SOON PAYMENT_RECEIPT_AUTO_CONFIRMED
`);
/** Signing notices: metadata names the signing envelope (agreementId, may be a child contract). */
export const AGREEMENT_TYPES = words(`
  AGREEMENT_REVIEW_READY AGREEMENT_SIGNING_TURN AGREEMENT_FULLY_SIGNED AGREEMENT_SIGNATURE_NEEDS_REVIEW
  AGREEMENT_SIGNING_DUE_SOON
`);
/** Amendment, renewal, termination and return/settlement notices: metadata names the root contract. */
export const CONTRACT_CHANGE_TYPES = words(`
  AMENDMENT_RESPONSE_NEEDED AMENDMENT_DECIDED AMENDMENT_WITHDRAWN AMENDMENT_EXPIRED AMENDMENT_APPLIED
  LEASE_RENEWAL_WINDOW_OPENED RENEWAL_REQUESTED RENEWAL_APPROVED RENEWAL_REJECTED RENEWAL_EXPIRED
  TERMINATION_APPROVED TERMINATION_RESPONSE_NEEDED TERMINATION_AGREED TERMINATION_DECLINED
  TERMINATION_WITHDRAWN TERMINATION_NOTICE_ISSUED TERMINATION_REVIEW_REQUESTED TERMINATION_REVIEW_APPROVED
  TERMINATION_NOTICE_CANCELLED TERMINATION_ENDED LEASE_EXPIRED
  LEASE_RETURN_CONFIRMED LEASE_RETURN_COMPLETED SETTLEMENT_RESPONSE_NEEDED SETTLEMENT_DISPUTED
  SETTLEMENT_PROPOSAL_INVALIDATED SETTLEMENT_AGREED SETTLEMENT_RESPONSE_OVERDUE SETTLEMENT_PAYMENT_OVERDUE
  LEASE_CLOSED
`);

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** Web recoverChanges(): anything may have been missed, so no ids (complaints are not part of it). */
export const recoveryEvents = (): RentalSyncEvent[] => [
  { type: 'rental-request-changed' },
  { type: 'payment-changed' },
  { type: 'invoice-changed' },
  { type: 'agreement-changed' },
];

/**
 * `socketEvent` is what subscribeNotificationEvents delivers: 'connect' (socket (re)connected),
 * 'notifications:changed' (push in foreground, or app back to the foreground), 'notification:new'.
 */
export function rentalSyncEvents(socketEvent: string, payload?: unknown): RentalSyncEvent[] {
  if (socketEvent === 'connect' || socketEvent === 'notifications:changed') return recoveryEvents();
  if (socketEvent !== 'notification:new' || !payload || typeof payload !== 'object') return [];
  const item = payload as { category?: unknown; type?: unknown; metadata?: unknown };
  const type = text(item.type) ?? '';
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  if (item.category === 'RENTAL_REQUEST') {
    const requestId = text(meta.requestId ?? meta.rentalRequestId);
    const events: RentalSyncEvent[] = [{ type: 'rental-request-changed', requestId }];
    if (type.startsWith('COMPLAINT_')) events.push({ type: 'complaint-changed', requestId });
    return events;
  }
  if (item.category === 'PAYMENT') {
    if (ROUTED_PAYMENT_TYPES.has(type))
      return [{ type: 'payment-changed', paymentId: text(meta.paymentId) }];
    if (INVOICE_TYPES.has(type))
      return [
        {
          type: 'invoice-changed',
          contractId: text(meta.contractId),
          invoiceId: text(meta.invoiceId),
        },
      ];
  }
  if (item.category === 'CONTRACT') {
    if (AGREEMENT_TYPES.has(type))
      return [{ type: 'agreement-changed', agreementId: text(meta.agreementId) }];
    if (CONTRACT_CHANGE_TYPES.has(type))
      return [{ type: 'agreement-changed', agreementId: text(meta.contractId) }];
  }
  return [];
}

/** Wires a signal source and "app became active" into a debounce controller from lib/rental. */
export function startChangeSync(options: {
  subscribe: (listener: (socketEvent: string, payload?: unknown) => void) => () => void;
  onActive: (listener: () => void) => () => void;
  matches: (event: RentalSyncEvent) => boolean;
  sync: { schedule: () => void; onVisible: () => void; dispose: () => void };
}): () => void {
  const unsubscribe = options.subscribe((socketEvent, payload) => {
    if (rentalSyncEvents(socketEvent, payload).some((event) => options.matches(event)))
      options.sync.schedule();
  });
  const offActive = options.onActive(() => options.sync.onVisible());
  return () => {
    unsubscribe();
    offActive();
    options.sync.dispose();
  };
}
