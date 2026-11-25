// Web: components/contract/page/PaymentTab.tsx. Lease: rent invoices. Deposit agreement: the deposit
// payment, adjustments and refund. The billing components belong to components/rental/billing.
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import DepositSettlementPanel from '@/components/rental/billing/DepositSettlementPanel';
import MonthlyInvoicesSection from '@/components/rental/billing/MonthlyInvoicesSection';
import RentalOnboardingPanel from '@/components/rental/onboarding/RentalOnboardingPanel';
import { Card } from '@/components/rental/shared/Card';
import { paymentModulePath, safeInvoiceSelectionId } from '@/lib/rental/payment-module';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';
import type { ContractResponse, ContractRevisionResponse } from '@/types/rental/contract.type';

import { Anchor } from './anchors';
import { monthlyInvoiceInputs } from './contractDetailLogic';
import { linkText } from './fields';

export default function PaymentTab({
  contract,
  revision,
  isLandlord,
  preActive,
  invoice,
  initialPayment,
  onUpdated,
  onSnapshot,
  onSelectInvoice,
  onTerminated,
  onNavigate,
}: {
  contract: ContractResponse;
  /** The revision the page already loaded; absent for deposit agreements. */
  revision?: ContractRevisionResponse | null;
  isLandlord: boolean;
  preActive: boolean;
  /** Raw ?invoice= of the route. */
  invoice?: string;
  /** Read-only ledger of the first payment (lease only). */
  initialPayment?: ReactNode;
  onUpdated: () => Promise<void>;
  onSnapshot: (view: RentalOnboarding) => void;
  /** D-032: the picked period is written back to the route. */
  onSelectInvoice?: (invoiceId: string) => void;
  /** D-103: a termination was completed or forced from the invoices. */
  onTerminated?: () => void;
  onNavigate: RentalNavigate;
}) {
  // An explicit but malformed invoice stays a distinct request (not-found), never "no request".
  const rawInvoice = invoice?.trim() || null;
  const requestedInvoiceId = safeInvoiceSelectionId(rawInvoice);
  const parent = contract.parentContractId;
  return (
    <>
      {preActive ? (
        <RentalOnboardingPanel
          rentalRequestId={contract.rentalRequestId}
          isLandlord={isLandlord}
          showDepositAgreement={false}
          sections={['payments']}
          onSnapshot={onSnapshot}
          onUpdated={onUpdated}
          onNavigate={onNavigate}
        />
      ) : parent ? (
        <Card>
          <Text className="text-sm leading-6 text-foreground">
            Các khoản thanh toán được quản lý trên hợp đồng gốc.
          </Text>
          <Pressable
            onPress={() => onNavigate(paymentModulePath(parent, 'monthly'))}
            accessibilityRole="link"
            className="min-h-11 justify-center">
            <Text className={linkText}>Mở thanh toán & hóa đơn của hợp đồng gốc</Text>
          </Pressable>
        </Card>
      ) : (
        <Anchor id="monthly-invoices">
          <MonthlyInvoicesSection
            key={contract.id}
            contractId={contract.id}
            rentalRequestId={contract.rentalRequestId}
            contractActive={contract.status === 'ACTIVE'}
            isLandlord={isLandlord}
            isTenant={!isLandlord}
            requestedInvoiceId={requestedInvoiceId}
            invalidInvoiceRequest={requestedInvoiceId ? null : rawInvoice}
            onUpdated={onUpdated}
            onSelectInvoice={onSelectInvoice}
            onTerminated={onTerminated}
            {...monthlyInvoiceInputs(revision)}
          />
        </Anchor>
      )}
      {preActive && contract.agreementKind === 'DEPOSIT' ? (
        <DepositSettlementPanel
          rentalRequestId={contract.rentalRequestId}
          isLandlord={isLandlord}
          onUpdated={onUpdated}
          onNavigate={onNavigate}
        />
      ) : null}
      {initialPayment}
    </>
  );
}
