// Web: components/contract/detail/ContractEquipmentSection.tsx. The table is one card per item.
// As on the web, equipment changes only through the listing sync preview.
import { Text, View } from 'react-native';

import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { formatHandoverCondition } from '@/lib/rental/ContractEquipmentSection';
import { str } from '@/lib/rental/utils';
import type { TermRow } from '@/types/rental/contract-amendment.type';

import { Anchor } from './anchors';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { NoticeText, RowCard, Section } from './fields';

export default function ContractEquipmentSection({
  equipments,
}: {
  equipments?: TermRow[] | null;
}) {
  const w = useAmendmentWorkspace();
  const items =
    (w?.editing ? w.listingSync?.terms.equipments : undefined) ??
    w?.data?.currentTerms.equipments ??
    equipments ??
    [];
  return (
    <Anchor id="amendment-equipments">
      <Section
        icon="cube-outline"
        title="Nội thất và tài sản bàn giao"
        subtitle="Trang thiết bị gắn liền với tài sản bàn giao theo hiện trạng thực tế"
        badge={`${items.length} thiết bị / nội thất`}>
        {items.length > 0 ? (
          items.map((item, index) => {
            const condition = formatHandoverCondition(item.condition || item.status);
            // The shared className is "<background> <text> <border>" tokens.
            const [background, color, border] = condition.className.split(' ');
            return (
              <RowCard
                key={index}
                title={
                  <Text className="text-sm font-bold text-foreground">
                    {index + 1}. {str(item.name || item.equipmentName)}
                  </Text>
                }>
                <InfoRow
                  label="Số lượng"
                  value={item.quantity != null ? str(item.quantity) : '01'}
                />
                <InfoRow
                  label="Hiện trạng"
                  value={
                    <View className={`rounded-md border px-2 py-1 ${background} ${border}`}>
                      <Text className={`text-xs font-semibold ${color}`}>{condition.label}</Text>
                    </View>
                  }
                />
                <InfoRow
                  label="Ghi chú"
                  value={str(item.note || 'Chưa có ghi chú bàn giao')}
                  stacked
                />
              </RowCard>
            );
          })
        ) : (
          <Text className="text-sm italic text-muted-foreground">
            Bàn giao nhà thô / cơ bản, không có danh mục nội thất rời.
          </Text>
        )}
        <PolicyNotice
          tone="neutral"
          icon="shield-checkmark-outline"
          title="Trách nhiệm kiểm tra thiết bị"
          summary="Bên B kiểm tra tình trạng và ký xác nhận tại Biên bản bàn giao.">
          <NoticeText>
            Bên B có trách nhiệm kiểm tra chi tiết tình trạng hoạt động và ký xác nhận tại Biên bản
            bàn giao khi nhận bàn giao thực tế.
          </NoticeText>
        </PolicyNotice>
      </Section>
    </Anchor>
  );
}
