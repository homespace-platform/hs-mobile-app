// Web components/payment/DepositLedgerSummary.tsx.
import { Text, View } from 'react-native';

import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import {
  isZeroDepositLedger,
  ledgerRows,
  ledgerStatusTitle,
  money,
} from '@/lib/rental/DepositLedgerSummary';
import { vnDateTime } from '@/lib/rental/format';
import type { DepositLedger } from '@/types/rental/deposit-ledger.type';

import { Notice } from './common';

export type DepositLedgerSummaryProps = {
  ledger?: DepositLedger | null;
};

export default function DepositLedgerSummary({ ledger }: DepositLedgerSummaryProps) {
  if (!ledger)
    return <Text className="text-sm text-muted-foreground">Chưa có sổ cọc để đối chiếu.</Text>;
  if (isZeroDepositLedger(ledger))
    return (
      <View
        accessibilityLabel="Sổ cọc"
        className="gap-2 rounded-2xl border border-border bg-surface p-4">
        <Text className="text-sm font-bold text-foreground">
          Không đặt cọc · Không có tiền cọc cần hoàn
        </Text>
        <PolicyNotice
          tone="neutral"
          title="Không đặt cọc"
          summary="Khi kết thúc thuê, hai bên vẫn cần xác nhận trả nhà và thanh toán các nghĩa vụ còn lại.">
          <Notice>
            Khi kết thúc thuê, hai bên vẫn cần xác nhận trả nhà và thanh toán các nghĩa vụ còn lại.
            Đây là ghi nhận miễn cọc, không phải chứng từ đã chuyển hoặc hoàn tiền.
          </Notice>
        </PolicyNotice>
      </View>
    );
  return (
    <View
      accessibilityLabel="Sổ cọc"
      className="gap-2 rounded-2xl border border-border bg-surface p-4">
      <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
        Sổ cọc · {ledgerStatusTitle(ledger)}
      </Text>
      <View className="divide-y divide-border">
        {ledgerRows(ledger).map(([label, value]) => (
          <InfoRow key={label} label={label} value={money(value)} />
        ))}
      </View>
      {ledger.retainedReason ? (
        <Text className="text-sm leading-6 text-foreground">
          Căn cứ giữ lại: {ledger.retainedReason}
        </Text>
      ) : null}
      {ledger.retainedAt ? (
        <Text className="text-sm text-muted-foreground">
          Chốt giữ lúc {vnDateTime(ledger.retainedAt)}
        </Text>
      ) : null}
      <PolicyNotice
        tone="neutral"
        title="Sổ cọc"
        summary="Đã thống nhất quyết toán hoặc đã báo chuyển chưa phải đã nhận tiền hoàn.">
        <Notice>
          Đã thống nhất quyết toán hoặc đã báo chuyển chưa phải đã nhận tiền hoàn. Khoản phải trả
          thêm vượt cọc được theo dõi riêng.
        </Notice>
      </PolicyNotice>
    </View>
  );
}
