// Web components/contract/page/DepositSettlementPanel.tsx: deposit adjustments and the settlement/refund of a
// deposit agreement. Both belong to the lease of the same rental request.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import { paymentQuery } from '@/lib/rental/payment-module';
import { contractService } from '@/services/rental/contract.service';
import type { ContractResponse } from '@/types/rental/contract.type';

import ContractLifecyclePanel from './ContractLifecyclePanel';
import { LinkButton, Notice } from './common';
import { DepositAdjustmentPayments } from './SettlementPaymentPanel';

export type DepositSettlementPanelProps = {
  rentalRequestId: string;
  isLandlord: boolean;
  /** Must refresh without unmounting this panel. */
  onUpdated: () => Promise<void>;
  /** Mobile only: web links to the lease contract. */
  onNavigate: RentalNavigate;
};

/** Keyed by request: the lease of another request is never shown while loading. */
export default function DepositSettlementPanel(props: DepositSettlementPanelProps) {
  return <Settlement key={props.rentalRequestId} {...props} />;
}

function Settlement({
  rentalRequestId,
  isLandlord,
  onUpdated,
  onNavigate,
}: DepositSettlementPanelProps) {
  const [lease, setLease] = useState<ContractResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    contractService
      .getByRentalRequest(rentalRequestId)
      .then((found) => {
        if (!live) return;
        setLease(!found || found.agreementKind || found.parentContractId ? null : found);
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [rentalRequestId, attempt]);
  const refreshed = useCallback(async () => {
    await onUpdated();
    setAttempt((n) => n + 1);
  }, [onUpdated]);

  if (failed && !lease)
    return (
      <View
        accessibilityRole="alert"
        className="gap-1 rounded-2xl border border-border bg-surface p-4">
        <Text className="text-sm leading-6 text-foreground">
          Chưa tải được hợp đồng thuê để xử lý hoàn cọc.
        </Text>
        <LinkButton label="Thử lại" onPress={() => setAttempt((n) => n + 1)} />
      </View>
    );
  if (!lease) return null;
  const own = contractDetailPath(isLandlord ? 'landlord' : 'tenant', lease.id);
  return (
    <View className="gap-4">
      <DepositAdjustmentPayments key={lease.id} contractId={lease.id} isLandlord={isLandlord} />
      {lease.status === 'TERMINATED' ? (
        <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            Hợp đồng thuê đã chấm dứt
          </Text>
          <PolicyNotice
            tone="neutral"
            title="Cọc khi hợp đồng đã chấm dứt"
            summary="Cọc được xử lý theo phương án chấm dứt; xem sổ cọc ở trên.">
            <Notice>
              Hợp đồng thuê đã chấm dứt theo phương án xử lý riêng, không qua bước quyết toán hoàn
              cọc thông thường. Tình trạng và căn cứ xử lý tiền cọc nằm ở sổ cọc phía trên. Các hóa
              đơn còn nợ vẫn phải thanh toán ở mục Hóa đơn thuê của hợp đồng thuê.
            </Notice>
          </PolicyNotice>
          <ActionButton
            label="Xem hóa đơn còn nợ →"
            onClick={() => onNavigate({ ...own, ...paymentQuery('monthly') })}
          />
          <ActionButton
            label="Xem kết quả chấm dứt"
            variant="secondary"
            onClick={() => onNavigate({ ...own, tab: 'end' })}
          />
        </View>
      ) : ['ACTIVE', 'EXPIRED', 'CLOSED'].includes(lease.status) ? (
        <ContractLifecyclePanel
          contractId={lease.id}
          isLandlord={isLandlord}
          showLedger={false}
          onUpdated={refreshed}
          onNavigate={onNavigate}
        />
      ) : null}
    </View>
  );
}
