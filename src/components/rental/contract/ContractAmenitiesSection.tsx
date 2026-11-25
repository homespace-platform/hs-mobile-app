// Web: components/contract/detail/ContractAmenitiesSection.tsx. The table is one numbered row per item.
// As on the web, amenities change only through the listing sync preview.
import { Text, View } from 'react-native';

import { str } from '@/lib/rental/utils';
import type { TermRow } from '@/types/rental/contract-amendment.type';

import { Anchor } from './anchors';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { Section } from './fields';

export default function ContractAmenitiesSection({ amenities }: { amenities?: TermRow[] | null }) {
  const w = useAmendmentWorkspace();
  const items =
    (w?.editing ? w.listingSync?.terms.amenities : undefined) ??
    w?.data?.currentTerms.amenities ??
    amenities ??
    [];
  return (
    <Anchor id="amendment-amenities">
      <Section
        icon="sparkles-outline"
        title="Tiện ích"
        subtitle="Danh sách tiện ích đã chốt trong hợp đồng"
        badge={`${items.length} tiện ích`}>
        {items.length > 0 ? (
          <View>
            {items.map((item, index) => (
              <View key={index} className="flex-row gap-3 border-b border-border py-2">
                <Text className="w-7 text-sm text-muted-foreground">{index + 1}</Text>
                <Text className="flex-1 text-sm font-semibold text-foreground">
                  {str(item.name)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-sm italic text-muted-foreground">
            Không có tiện ích được ghi nhận.
          </Text>
        )}
      </Section>
    </Anchor>
  );
}
