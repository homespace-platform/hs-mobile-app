// Web: components/contract/page/OverviewTab.tsx.
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { Card, SectionTitle } from '@/components/rental/shared/Card';
import InfoRow from '@/components/rental/shared/InfoRow';
import { documentDate } from '@/lib/rental/contract-document-history';
import { usePageData } from '@/lib/rental/pageData';
import { DETAIL_TABS, type DetailTab, type Role } from '@/lib/rental/rental-labels';
import type { Milestone } from '@/lib/rental/timeline';

import { invoiceSummary, shownRows, type InfoCardData } from './contractDetailLogic';

type IconName = ComponentProps<typeof Icon>['name'];

const SHORTCUTS: Record<Exclude<DetailTab, 'overview'>, { icon: IconName; hint: string }> = {
  sign: { icon: 'create-outline', hint: 'Ký số, xem PDF và bằng chứng blockchain' },
  payment: { icon: 'card-outline', hint: 'Chuyển khoản, xác nhận và sổ tiền cọc' },
  end: { icon: 'close-circle-outline', hint: 'Hủy, gia hạn, phụ lục và khiếu nại' },
  content: { icon: 'document-text-outline', hint: 'Toàn bộ điều khoản của hợp đồng' },
  history: { icon: 'time-outline', hint: 'Phụ lục, phiên bản tài liệu, nhật ký' },
};

function InfoCard({ title, rows }: InfoCardData) {
  const shown = shownRows(rows);
  if (!shown.length) return null;
  return (
    <Card>
      <Text accessibilityRole="header" className="mb-2 text-base font-bold text-foreground">
        {title}
      </Text>
      {shown.map(([label, value]) => (
        <InfoRow key={label} label={label} value={value} className="border-b border-border" />
      ))}
    </Card>
  );
}

function Timeline({ steps }: { steps: Milestone[] }) {
  return (
    <View>
      {steps.map((step, index) => (
        <View key={step.label} className="flex-row gap-3">
          <View className="items-center">
            <View
              className={`h-7 w-7 items-center justify-center rounded-full border ${
                step.done
                  ? 'border-primary bg-brand'
                  : step.current
                    ? 'border-2 border-primary bg-surface'
                    : 'border-border bg-surface'
              }`}>
              {step.done ? (
                <Icon name="checkmark" size={16} className="text-on-brand" />
              ) : (
                <Text
                  className={`text-xs font-bold ${step.current ? 'text-primary' : 'text-muted-foreground'}`}>
                  {index + 1}
                </Text>
              )}
            </View>
            {index < steps.length - 1 ? (
              <View className={`w-0.5 flex-1 ${step.done ? 'bg-primary' : 'bg-muted'}`} />
            ) : null}
          </View>
          <View
            accessible
            accessibilityState={{ checked: step.done }}
            className={`flex-1 gap-1 pt-0.5 ${index < steps.length - 1 ? 'pb-4' : ''}`}>
            <Text
              className={`text-sm font-semibold ${step.done || step.current ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step.label}
            </Text>
            {step.current ? <Badge tone="info">Đang ở bước này</Badge> : null}
            {step.at ? (
              <Text className="text-sm text-muted-foreground">{documentDate(step.at)}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function OverviewTab({
  cards,
  timeline,
  showInvoices,
  onboardingSummary,
  role,
}: {
  cards: InfoCardData[];
  timeline?: Milestone[];
  /** Root lease that is already in effect: show the invoices summary. */
  showInvoices: boolean;
  /** Pre-tenancy progress panel. */
  onboardingSummary?: ReactNode;
  role: Role;
}) {
  const { lifecycle, setTab, available } = usePageData();
  const invoices = invoiceSummary(lifecycle?.billing.bills ?? null, role);
  return (
    <>
      {onboardingSummary}
      {cards.map((card) => (
        <InfoCard key={card.title} {...card} />
      ))}

      {showInvoices ? (
        <Card className="gap-3">
          <SectionTitle
            title="Thanh toán & hóa đơn"
            hint="Hóa đơn thuê từng kỳ nằm ở mục Thanh toán & cọc. Cọc và hoàn cọc nằm ở hợp đồng cọc."
          />
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary-soft">
              <Icon name="receipt-outline" size={20} className="text-primary" />
            </View>
            <View className="flex-1">
              <Text
                className={`text-sm leading-5 ${lifecycle ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {invoices.title}
              </Text>
              {invoices.detail ? (
                <Text className="text-sm leading-5 text-muted-foreground">{invoices.detail}</Text>
              ) : null}
            </View>
          </View>
          <ActionButton
            label="Xem thanh toán & hóa đơn"
            icon="arrow-forward"
            onClick={() => setTab('payment')}
          />
        </Card>
      ) : null}

      {timeline?.length ? (
        <Card className="gap-3">
          <SectionTitle
            title="Hành trình hợp đồng"
            hint="Các mốc từ lúc soạn đến khi hợp đồng có hiệu lực."
          />
          <Timeline steps={timeline} />
        </Card>
      ) : null}

      <View className="gap-2">
        <SectionTitle title="Đi tới mục khác" hint="Mỗi việc cần làm nằm ở đúng một mục." />
        {DETAIL_TABS.filter((t) => t.id !== 'overview' && available.includes(t.id)).map((t) => {
          const shortcut = SHORTCUTS[t.id as Exclude<DetailTab, 'overview'>];
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="button"
              className="min-h-16 flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-muted">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                <Icon name={shortcut.icon} size={20} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">{t.label}</Text>
                <Text className="text-sm leading-5 text-muted-foreground">{shortcut.hint}</Text>
              </View>
              <Icon name="chevron-forward" size={18} className="text-muted-foreground" />
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
