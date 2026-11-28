// Web: components/contract/detail/ContractPropertySection.tsx. The feature table is one row per item.
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import InfoRow from '@/components/rental/shared/InfoRow';
import { squareMetresText } from '@/lib/rental/contract-amendment-input';
import { contractPropertyFeatureValue } from '@/lib/rental/contract-property-feature-labels';
import { useContractDraftEditor } from '@/lib/rental/ContractDraftEditor';
import { str } from '@/lib/rental/utils';
import type { TermRow } from '@/types/rental/contract-amendment.type';

import { Anchor } from './anchors';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { FieldRow, RowCard, Section } from './fields';

const filled = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== '';

export default function ContractPropertySection({ property: original }: { property: TermRow }) {
  const w = useAmendmentWorkspace();
  const draft = useContractDraftEditor();
  const property =
    (w?.editing ? w.listingSync?.terms.property : undefined) ??
    w?.data?.currentTerms.property ??
    original;
  const { unitNumber, floor, rentalScope, maxOccupants, maxVehicles, listingCode } = property;
  const features = Array.isArray(property.features) ? (property.features as TermRow[]) : [];

  return (
    <Anchor id={draft ? 'contract-property' : 'amendment-property'}>
      <Section
        icon="home-outline"
        title="Thông tin bàn giao địa điểm thuê"
        badge={listingCode ? `Mã tin: ${str(listingCode)}` : undefined}>
        <View>
          <FieldRow label="Địa chỉ tài sản" value={property.fullAddress} highlight />
          <FieldRow label="Loại hình" value={property.propertyType} />
          <FieldRow label="Diện tích sử dụng" value={squareMetresText(property.areaText)} />
          <FieldRow label="Số căn / phòng" value={unitNumber ? str(unitNumber) : 'Toàn bộ căn'} />
          <FieldRow label="Tầng / Độ cao" value={floor} />
          <FieldRow
            label="Phạm vi cho thuê"
            value={rentalScope ? str(rentalScope) : 'Toàn bộ diện tích tài sản'}
          />
          <FieldRow
            label="Số người tối đa"
            value={filled(maxOccupants) ? `${maxOccupants} người` : 'Theo thỏa thuận'}
          />
          <FieldRow
            label="Số xe tối đa"
            value={
              !filled(maxVehicles)
                ? 'Theo thỏa thuận'
                : Number(maxVehicles) === 0
                  ? '0 xe (Không giữ xe)'
                  : `${maxVehicles} xe`
            }
          />
        </View>
        <View className="flex-row items-start gap-2 rounded-xl border border-border bg-muted px-3 py-2.5">
          <Icon name="key-outline" size={16} className="text-primary" />
          <Text className="flex-1 text-xs leading-5 text-muted-foreground">
            Tài sản được bàn giao độc lập theo đúng hiện trạng mô tả trong hợp đồng và biên bản bàn
            giao đính kèm.
          </Text>
        </View>
        {features.length > 0 ? (
          <RowCard
            title={
              <View className="flex-row justify-between gap-3">
                <Text className="text-xs font-bold text-muted-foreground">Đặc điểm tài sản</Text>
                <Text className="text-xs font-bold text-muted-foreground">Giá trị</Text>
              </View>
            }>
            {features.map((row, i) => (
              <InfoRow
                key={i}
                label={str(row.featureName)}
                value={str(contractPropertyFeatureValue(row.featureName, row.featureValue))}
              />
            ))}
          </RowCard>
        ) : null}
      </Section>
    </Anchor>
  );
}
