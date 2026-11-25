// Web: components/contract/page/HistoryTab.tsx.
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import RentalOnboardingPanel from '@/components/rental/onboarding/RentalOnboardingPanel';
import ActionButton from '@/components/rental/shared/ActionButton';
import { Card, SectionTitle } from '@/components/rental/shared/Card';
import {
  amendmentDocumentStatus,
  amendmentDocumentTitle,
  concreteProposals,
  documentDate,
} from '@/lib/rental/contract-document-history';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { usePageData } from '@/lib/rental/pageData';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';
import type { ContractResponse } from '@/types/rental/contract.type';

import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { linkText } from './fields';

function AmendmentHistory({
  perspective,
  onNavigate,
}: {
  perspective: DashboardRole;
  onNavigate: RentalNavigate;
}) {
  const w = useAmendmentWorkspace();
  const data = w?.data;
  if (!data) return null;
  const rows = [...concreteProposals(data.proposals)].reverse();
  return (
    <Card className="gap-3">
      <SectionTitle
        title="Phụ lục & điều chỉnh"
        hint="Các đề xuất đổi điều khoản, từ mới nhất đến cũ nhất."
      />
      {rows.length === 0 ? (
        <Text className="text-sm text-muted-foreground">
          Chưa có phụ lục hay đề xuất điều chỉnh nào.
        </Text>
      ) : (
        rows.map((p) => (
          <View key={p.id} className="border-b border-border pb-2">
            <Text className="text-sm font-semibold text-foreground">
              {amendmentDocumentTitle(p)}
            </Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              Áp dụng từ {documentDate(p.effectiveOn)} ·{' '}
              {amendmentDocumentStatus(p, data.serverNow)}
            </Text>
            {p.agreementContractId ? (
              <Pressable
                onPress={() => onNavigate(contractDetailPath(perspective, p.agreementContractId!))}
                accessibilityRole="link"
                className="min-h-11 justify-center self-start">
                <Text className={linkText}>Mở phụ lục</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
}

export default function HistoryTab({
  contract,
  isLandlord,
  perspective,
  preActive,
  onUpdated,
  onSnapshot,
  onNavigate,
}: {
  contract: ContractResponse;
  isLandlord: boolean;
  perspective: DashboardRole;
  preActive: boolean;
  onUpdated: () => Promise<void>;
  onSnapshot: (view: RentalOnboarding) => void;
  onNavigate: RentalNavigate;
}) {
  const { goTo, available } = usePageData();
  return (
    <>
      {!contract.parentContractId ? (
        <AmendmentHistory perspective={perspective} onNavigate={onNavigate} />
      ) : null}
      {available.includes('sign') ? (
        <Card className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
              <Icon name="documents-outline" size={20} className="text-primary" />
            </View>
            <View className="flex-1">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                Phiên bản tài liệu
              </Text>
              <Text className="text-sm leading-5 text-muted-foreground">
                Mọi tệp Word/PDF đã tạo, các mốc ký và bằng chứng blockchain.
              </Text>
            </View>
          </View>
          <ActionButton
            label="Xem lịch sử tệp"
            variant="secondary"
            onClick={() => goTo('sign', 'contract-document-history')}
          />
        </Card>
      ) : null}
      {preActive ? (
        <View className="gap-3">
          <SectionTitle title="Nhật ký hồ sơ thuê" hint="Những gì đã diễn ra từ lúc đặt cọc." />
          <RentalOnboardingPanel
            rentalRequestId={contract.rentalRequestId}
            isLandlord={isLandlord}
            showDepositAgreement={false}
            sections={['history']}
            onSnapshot={onSnapshot}
            onUpdated={onUpdated}
            onNavigate={onNavigate}
          />
        </View>
      ) : null}
    </>
  );
}
