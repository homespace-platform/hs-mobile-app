// Web: components/contract/page/EndTab.tsx.
import { Text, View } from 'react-native';

import ComplaintPanel from '@/components/rental/billing/ComplaintPanel';
import RentalOnboardingPanel from '@/components/rental/onboarding/RentalOnboardingPanel';
import RentalWorkflowPanel from '@/components/rental/onboarding/RentalWorkflowPanel';
import { SectionTitle } from '@/components/rental/shared/Card';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';
import type { ContractResponse } from '@/types/rental/contract.type';

import ContractAmendmentPanel from './ContractAmendmentPanel';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { endBlocks } from './contractDetailLogic';
import ContractRenewalPanel from './ContractRenewalPanel';
import { NoticeText } from './fields';

const strong = 'font-bold text-foreground';

/** Plain-language rules (the server enforces them; this only explains them). */
function CancelRules({ preActive }: { preActive: boolean }) {
  return preActive ? (
    <PolicyNotice
      tone="info"
      title="Khi nào được hủy và hoàn tiền?"
      actionLabel="Xem quy tắc hủy"
      summary="Hủy trước khi ký đủ hợp đồng thuê: tiền cọc có thể bị giữ, tiền thuê tháng đầu được hoàn.">
      <Text className={`mb-3 text-sm leading-6 ${strong}`}>Ba trường hợp hủy hồ sơ thuê</Text>
      <NoticeText>
        • <Text className={strong}>Hợp đồng thuê đã ký đủ hai bên:</Text> không thể hủy. Muốn kết
        thúc, hai bên dùng chấm dứt hợp đồng.
      </NoticeText>
      <NoticeText>
        • <Text className={strong}>Hợp đồng cọc đã ký đủ nhưng hợp đồng thuê chưa ký đủ:</Text> vẫn
        được hủy, nhưng tiền cọc bị mất (chủ nhà giữ). Tiền thuê tháng đầu được hoàn lại.
      </NoticeText>
      <NoticeText>
        • <Text className={strong}>Các trường hợp còn lại</Text> (chưa ký hợp đồng cọc): hoàn lại
        toàn bộ số tiền đã chuyển.
      </NoticeText>
      <NoticeText muted>
        Tiền hoàn được chuyển khoản; người nhận xác nhận đã nhận (sau một khoảng thời gian không
        phản hồi, hệ thống sẽ tự xác nhận).
      </NoticeText>
    </PolicyNotice>
  ) : (
    <PolicyNotice
      tone="info"
      title="Kết thúc hợp đồng đang có hiệu lực"
      actionLabel="Xem quy tắc"
      summary="Hợp đồng đã ký đủ không thể hủy. Muốn kết thúc sớm, hai bên thống nhất chấm dứt hợp đồng.">
      <NoticeText>
        • Hợp đồng thuê đã ký đủ hai bên <Text className={strong}>không thể hủy</Text>.
      </NoticeText>
      <NoticeText>
        • Kết thúc sớm: một bên gửi đề nghị chấm dứt, bên còn lại đồng ý và hai bên ký văn bản chấm
        dứt.
      </NoticeText>
      <NoticeText>
        • Tiền cọc được bàn giao và quyết toán ở mục Thanh toán & cọc của hợp đồng cọc.
      </NoticeText>
      <NoticeText>
        • Muốn kéo dài thời gian thuê, dùng mục Gia hạn bên dưới. Muốn đổi điều khoản (giá, phí…),
        dùng Phụ lục / điều chỉnh.
      </NoticeText>
    </PolicyNotice>
  );
}

/** The amendment panel lives in "Hủy / kết thúc", except while a draft is edited inline. */
export function AmendmentSlot({
  where,
  contractId,
  actorId,
  perspective,
  onNavigate,
}: {
  where: 'end' | 'content';
  contractId: string;
  actorId: string;
  perspective: DashboardRole;
  onNavigate: RentalNavigate;
}) {
  const editing = Boolean(useAmendmentWorkspace()?.editing);
  if ((where === 'content') !== editing) return null;
  return (
    <ContractAmendmentPanel
      contractId={contractId}
      actorId={actorId}
      perspective={perspective}
      onNavigate={onNavigate}
    />
  );
}

export default function EndTab({
  contract,
  isLandlord,
  actorId,
  perspective,
  preActive,
  onUpdated,
  onSnapshot,
  onNavigate,
}: {
  contract: ContractResponse;
  isLandlord: boolean;
  actorId: string;
  perspective: DashboardRole;
  /** Pre-tenancy: cancellation of the rental request. Otherwise a lease in effect. */
  preActive: boolean;
  onUpdated: () => Promise<void>;
  onSnapshot: (view: RentalOnboarding) => void;
  onNavigate: RentalNavigate;
}) {
  const blocks = endBlocks(contract, preActive);
  return (
    <>
      <CancelRules preActive={preActive} />
      {preActive ? (
        <RentalOnboardingPanel
          rentalRequestId={contract.rentalRequestId}
          isLandlord={isLandlord}
          showDepositAgreement={false}
          sections={['end']}
          onSnapshot={onSnapshot}
          onUpdated={onUpdated}
          onNavigate={onNavigate}
        />
      ) : null}
      {blocks.earlyExit ? (
        <View className="gap-3">
          <SectionTitle
            title="Kết thúc sớm / trả nhà"
            hint="Đề nghị chấm dứt hoặc trả nhà trước hạn, có sự đồng ý của hai bên."
          />
          <RentalWorkflowPanel
            rentalRequestId={contract.rentalRequestId}
            kind="early-exit"
            contractId={contract.id}
            onUpdated={onUpdated}
            onNavigate={onNavigate}
          />
        </View>
      ) : null}
      {blocks.renewal ? (
        <View className="gap-3">
          <SectionTitle
            title="Gia hạn thời gian thuê"
            hint="Kéo dài thời hạn thuê. Dời hạn thanh toán một hóa đơn là việc khác, nằm trong mục hóa đơn."
          />
          <ContractRenewalPanel
            key={`${actorId}:${contract.id}`}
            contractId={contract.id}
            isLandlord={isLandlord}
            onUpdated={onUpdated}
            onNavigate={onNavigate}
          />
        </View>
      ) : null}
      {blocks.amendments ? (
        <View className="gap-3">
          <SectionTitle
            title="Phụ lục / điều chỉnh"
            hint="Đổi điều khoản đã ký (giá thuê, phí, số người…). Có hiệu lực sau khi hai bên ký."
          />
          <AmendmentSlot
            where="end"
            contractId={contract.id}
            actorId={actorId}
            perspective={perspective}
            onNavigate={onNavigate}
          />
        </View>
      ) : null}
      {blocks.complaint ? (
        <View className="gap-3">
          <SectionTitle
            title="Khiếu nại"
            hint="Gửi và theo dõi khiếu nại liên quan đến hợp đồng đang thuê."
          />
          <ComplaintPanel rentalRequestId={contract.rentalRequestId} onUpdated={onUpdated} />
        </View>
      ) : null}
    </>
  );
}
