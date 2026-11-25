import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  VIEWING_DAY_LABELS,
  VIEWING_SLOT_LABELS,
  type FurnishingView,
  type RentDetailSection,
} from '@/lib/rent-detail';
import type { ListingDetail } from '@/services/listingApi';
import { Chip, DetailRow, Notice, SectionCard } from './DetailSectionCard';

const FURNISHING_TITLE = 'Trang thiết bị / Nội thất bàn giao';

export function DetailSections({ sections }: { sections: RentDetailSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <SectionCard key={section.title} title={section.title} icon="layers-outline">
          {section.items.map((item) => (
            <DetailRow key={item.label} label={item.label} value={item.value} />
          ))}
        </SectionCard>
      ))}
    </>
  );
}

// Port of web components/listing/ListingPoliciesCard.tsx.
export function PoliciesCard({ rows }: { rows?: NonNullable<ListingDetail['policies']> }) {
  return (
    <SectionCard title="Chính sách & nội quy thuê" icon="shield-checkmark-outline">
      <Notice
        title="Chính sách & nội quy thuê"
        text="Quy định do chủ nhà công bố. Các chính sách được chốt trong hợp đồng khi hai bên xác lập thỏa thuận thuê."
      />
      {rows?.length ? (
        <View className="mt-3">
          {rows.map((row) => (
            <View key={row.code} className="border-b border-border/60 py-3">
              <Text className="text-xs text-muted-foreground">{row.label}</Text>
              <Text className="mt-1 text-sm font-medium text-foreground">{row.displayValue}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="mt-3 text-sm text-muted-foreground">
          Chủ nhà chưa công bố chính sách cho bài đăng này. Hãy hỏi rõ trước khi gửi yêu cầu thuê.
        </Text>
      )}
    </SectionCard>
  );
}

export function AmenitiesSection({ amenities }: { amenities: string[] }) {
  if (!amenities.length) return null;
  return (
    <SectionCard title="Tiện ích tòa nhà & dịch vụ" icon="checkmark-circle-outline">
      <View className="flex-row flex-wrap gap-2">
        {amenities.map((item, index) => (
          <Chip key={`${item}-${index}`} label={item} icon="checkmark-circle-outline" />
        ))}
      </View>
    </SectionCard>
  );
}

export function FurnishingSection({ furnishing }: { furnishing: FurnishingView }) {
  if (furnishing.kind === 'none') return null;
  return (
    <SectionCard title={FURNISHING_TITLE} icon="home-outline">
      {furnishing.kind === 'table' ? (
        <View className="overflow-hidden rounded-xl border border-border">
          <View className="flex-row bg-muted px-3 py-2.5">
            <Text className="w-10 text-xs font-semibold text-muted-foreground">STT</Text>
            <Text className="flex-1 text-xs font-semibold text-muted-foreground">
              Tên tài sản / Trang thiết bị
            </Text>
            <Text className="w-16 text-xs font-semibold text-muted-foreground">Số lượng</Text>
            <Text className="flex-1 text-xs font-semibold text-muted-foreground">
              Hiện trạng bàn giao
            </Text>
          </View>
          {furnishing.rows.map((item, index) => (
            <View
              key={`${item.assetName}-${index}`}
              className="flex-row border-t border-border/60 px-3 py-2.5">
              <Text className="w-10 text-sm text-muted-foreground">{item.index ?? index + 1}</Text>
              <Text className="flex-1 pr-2 text-sm font-medium text-foreground">
                {item.assetName}
              </Text>
              <Text className="w-16 text-sm text-foreground">{item.quantity ?? 1}</Text>
              <Text className="flex-1 text-sm text-muted-foreground">
                {item.conditionText || item.handoverCondition || 'Chưa ghi nhận'}
                {!item.conditionText && item.conditionNote ? ` (${item.conditionNote})` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : furnishing.kind === 'chips' ? (
        <View className="flex-row flex-wrap gap-2">
          {furnishing.items.map((item, index) => (
            <Chip key={`${item}-${index}`} label={item} icon="checkmark-circle-outline" />
          ))}
        </View>
      ) : (
        <Notice text={furnishing.text} />
      )}
    </SectionCard>
  );
}

export function ViewingSection({ days, slots }: { days: string[]; slots: string[] }) {
  if (!days.length && !slots.length) return null;
  return (
    <SectionCard title="Lịch hẹn xem nhà" icon="calendar-outline">
      <View className="gap-4">
        {days.length > 0 ? (
          <View>
            <Text className="mb-2 text-sm font-medium text-muted-foreground">
              Ngày tiếp khách trong tuần
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {days.map((day) => (
                <View key={day} className="rounded-lg border border-border bg-muted px-3 py-1.5">
                  <Text className="text-sm font-medium text-foreground">
                    {VIEWING_DAY_LABELS[day] || day}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {slots.length > 0 ? (
          <View>
            <Text className="mb-2 text-sm font-medium text-muted-foreground">
              Khung giờ tiếp khách
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {slots.map((slot) => (
                <View
                  key={slot}
                  className="rounded-lg border border-primary-border bg-primary-soft px-3 py-1.5">
                  <Text className="text-sm font-medium text-primary">
                    {VIEWING_SLOT_LABELS[slot] || slot}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </SectionCard>
  );
}

export function DescriptionSection({ description }: { description?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!description) return null;
  const long = description.length > 600;
  return (
    <SectionCard title="Mô tả chi tiết" icon="document-text-outline">
      <Text
        numberOfLines={long && !expanded ? 10 : undefined}
        className="text-[15px] leading-7 text-foreground">
        {description}
      </Text>
      {long ? (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          className="mt-3 min-h-11 justify-center">
          <Text className="text-sm font-semibold text-primary">
            {expanded ? 'Thu gọn' : 'Xem thêm'}
          </Text>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}
