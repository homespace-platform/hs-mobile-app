// Web: components/contract/detail/ContractChargesSection.tsx. The table is one card per charge.
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { formatBillingMethod } from '@/lib/rental/ContractChargesSection';
import { str } from '@/lib/rental/utils';
import type { TermRow } from '@/types/rental/contract-amendment.type';

import { Anchor } from './anchors';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { NoticeText, RowCard, Section } from './fields';
import InlineAmendmentFields from './InlineAmendmentFields';

const editableValue = (text: string) => (
  <Text selectable className="text-right text-sm font-semibold text-primary">
    {text}
  </Text>
);

export default function ContractChargesSection({ charges }: { charges?: TermRow[] | null }) {
  const w = useAmendmentWorkspace();
  const items =
    (w?.editing ? w.listingSync?.terms.charges : undefined) ??
    w?.data?.currentTerms.charges ??
    charges ??
    [];
  return (
    <Anchor id="amendment-charges">
      <Section
        icon="receipt-outline"
        title="Phí dịch vụ và chi phí sinh hoạt"
        subtitle="Đơn giá, cách thức tính phí và phân loại chi phí định kỳ hoặc theo công tơ"
        badge={`${items.length} khoản phí`}>
        {w?.editing && w.editingFinancial ? (
          <InlineAmendmentFields group="charges" />
        ) : items.length > 0 ? (
          items.map((charge, index) => {
            const method = String(charge.billingMethod || '');
            return (
              <RowCard
                key={index}
                title={
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-muted-foreground">{index + 1}.</Text>
                    {method === 'PER_KWH' ? (
                      <Icon name="flash-outline" size={16} className="text-warning" />
                    ) : method === 'PER_M3' ? (
                      <Icon name="water-outline" size={16} className="text-primary" />
                    ) : null}
                    <Text className="flex-1 text-sm font-bold text-primary">
                      {str(charge.name)}
                    </Text>
                  </View>
                }>
                <InfoRow
                  label="Mức phí / Đơn giá"
                  value={editableValue(str(charge.amountAndMethod || charge.amount))}
                />
                <InfoRow
                  label="Đơn vị tính"
                  value={editableValue(
                    formatBillingMethod(charge.billingMethod || charge.billingMethodText)
                  )}
                />
                <InfoRow
                  label="Ghi chú / Điều kiện"
                  value={str(charge.note || 'Theo mức sử dụng thực tế')}
                  stacked
                />
              </RowCard>
            );
          })
        ) : (
          <PolicyNotice
            tone="neutral"
            title="Phí dịch vụ trong hợp đồng"
            summary="Chưa có khoản phí dịch vụ được ghi nhận trong hợp đồng.">
            <NoticeText>
              Chưa có khoản phí dịch vụ được ghi nhận trong hợp đồng. Không tự suy ra các dịch vụ đã
              miễn phí hoặc bao gồm trong giá thuê.
            </NoticeText>
          </PolicyNotice>
        )}
        <PolicyNotice
          tone="neutral"
          title="Chi phí tính theo công tơ"
          summary="Điện, nước sinh hoạt được chốt chỉ số định kỳ hàng tháng.">
          <NoticeText>
            Các chi phí tính theo công tơ (điện, nước sinh hoạt) sẽ được chốt chỉ số định kỳ hàng
            tháng theo đúng đơn giá ghi trong bảng này.
          </NoticeText>
        </PolicyNotice>
      </Section>
    </Anchor>
  );
}
