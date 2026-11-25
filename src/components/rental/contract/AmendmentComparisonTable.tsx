// Web: AmendmentComparisonTable in components/contract/detail/ContractAmendmentPanel.tsx:24-33 (its
// narrow-screen card layout). Also meant for the mobile amendment panel.
import { Text, View } from 'react-native';

import { comparisonValue } from '@/lib/rental/ContractAmendmentPanel';
import type { AmendmentComparison } from '@/types/rental/contract-amendment.type';

export default function AmendmentComparisonTable({
  rows,
  beforeLabel = 'Đang áp dụng',
  afterLabel = 'Đề xuất mới',
}: {
  rows: AmendmentComparison[];
  beforeLabel?: string;
  afterLabel?: string;
}) {
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View key={row.field} className="overflow-hidden rounded-xl border border-border">
          <Text className="bg-muted px-3 py-2 text-sm font-semibold text-foreground">
            {row.label}
          </Text>
          <View className="gap-1 p-3">
            <Text className="text-xs text-muted-foreground">{beforeLabel}</Text>
            <Text selectable className="text-sm leading-6 text-muted-foreground">
              {comparisonValue(row, row.before)}
            </Text>
          </View>
          <View className="gap-1 border-t border-border bg-primary-soft p-3">
            <Text className="text-xs font-medium text-primary">{afterLabel}</Text>
            <Text selectable className="text-sm leading-6 text-foreground">
              {comparisonValue(row, row.after)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
