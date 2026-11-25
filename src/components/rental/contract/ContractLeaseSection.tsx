// Web: components/contract/detail/ContractLeaseSection.tsx.
import { Text, View } from 'react-native';

import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { str } from '@/lib/rental/utils';
import type { TermRow } from '@/types/rental/contract-amendment.type';

import { Anchor } from './anchors';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { FieldRow, NoticeText, Section } from './fields';
import { ContractTermFields } from './InlineAmendmentFields';

export default function ContractLeaseSection({
  lease: original,
  agreedEarlyEndExclusive,
}: {
  lease: TermRow;
  agreedEarlyEndExclusive?: string | null;
}) {
  const w = useAmendmentWorkspace();
  const lease = w?.data?.currentTerms.lease ?? original;
  const durationText = String(lease.durationText ?? '').trim();
  const durationMonths = String(lease.durationMonths ?? '').trim();
  const monthLabel = /^[1-9]\d*$/.test(durationMonths) ? `${durationMonths} tháng` : '';
  const hasMonthTotal =
    monthLabel && new RegExp(`(?:^|\\D)${durationMonths}\\s+tháng\\b`, 'i').test(durationText);
  const durationLabel =
    durationText && monthLabel && !hasMonthTotal
      ? `${durationText} (${monthLabel})`
      : durationText || monthLabel;

  if (w?.editing)
    return (
      <Anchor id="amendment-lease">
        <Section title="Thời hạn thuê và bàn giao">
          <ContractTermFields
            group="lease"
            fields={[
              ['startDateText', 'Ngày bắt đầu tính tiền thuê'],
              ['endDateText', 'Ngày kết thúc hợp đồng'],
              ['durationMonths', 'Số tháng thuê'],
              ['durationText', 'Thời hạn thuê'],
              ['handoverDateText', 'Ngày bàn giao tài sản'],
            ]}
          />
          <PolicyNotice
            tone="neutral"
            title="Đổi ngày bắt đầu thuê"
            summary="Ngày kết thúc khép đủ kỳ thuê tháng.">
            <NoticeText>
              Ngày kết thúc khép đủ kỳ thuê tháng. Nếu đổi ngày bắt đầu, chọn đúng ngày hiệu lực của
              phụ lục; kỳ thuê và khoản thu trước đó được giữ nguyên.
            </NoticeText>
          </PolicyNotice>
        </Section>
      </Anchor>
    );

  return (
    <Section
      icon="calendar-outline"
      title="Thời hạn thuê và bàn giao"
      badge="Thời hạn trong điều khoản đang áp dụng">
      {agreedEarlyEndExclusive ? (
        <View className="gap-2 rounded-xl border border-primary-border bg-primary-soft p-3">
          <Text className="text-sm font-semibold text-foreground">
            Đã thống nhất kết thúc thuê sớm
          </Text>
          <Text className="text-sm leading-5 text-foreground">
            Mốc kết thúc đang áp dụng: {agreedEarlyEndExclusive.split('-').reverse().join('/')} lúc
            00:00 (không gồm ngày này).
          </Text>
          <PolicyNotice
            tone="neutral"
            title="Thời hạn thuê theo phụ lục"
            summary="Thời hạn gốc trong văn bản đã ký được giữ nguyên để đối chiếu.">
            <NoticeText>
              Thời hạn gốc trong văn bản đã ký bên dưới được giữ nguyên để đối chiếu. Bàn giao và
              quyết toán thực hiện riêng.
            </NoticeText>
          </PolicyNotice>
        </View>
      ) : null}
      <View>
        <FieldRow
          editable
          label="Ngày bắt đầu tính tiền thuê"
          value={lease.startDateText}
          highlight
        />
        <FieldRow
          editable
          label={
            agreedEarlyEndExclusive ? 'Ngày kết thúc theo văn bản đã ký' : 'Ngày kết thúc hợp đồng'
          }
          value={lease.endDateText}
        />
        <FieldRow editable label="Thời hạn thuê" value={durationLabel} />
        <FieldRow
          editable
          label="Ngày bàn giao tài sản"
          value={lease.handoverDateText ? str(lease.handoverDateText) : 'Cùng ngày bắt đầu thuê'}
        />
      </View>
    </Section>
  );
}
