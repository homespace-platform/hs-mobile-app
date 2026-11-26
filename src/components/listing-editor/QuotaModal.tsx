// Web components/membership/InsufficientQuotaModal (editor context).
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import ModalShell from '@/components/rental/shared/ModalShell';
import {
  formatVndPrice,
  getAddonBalanceLabel,
  getQuotaResetLabel,
  getTierShortLabel,
  mergeMembershipPlans,
} from '@/lib/membership';
import type { ListingSubmissionAction } from '@/services/listingCreateApi';
import type { MembershipView } from '@/services/membershipApi';

import { Notice } from './ui';

export default function QuotaModal({
  membership,
  action,
  saving,
  onClose,
  onSave,
  onSaveAndBuy,
  onSaveAndBuyAddon,
}: {
  membership: MembershipView | null;
  /** What the API lets this listing do: save a draft, or only send the edit for review. */
  action: ListingSubmissionAction;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onSaveAndBuy: () => void;
  onSaveAndBuyAddon: () => void;
}) {
  const reset = getQuotaResetLabel(membership);
  const draft = action === 'SAVE_DRAFT';
  return (
    <ModalShell
      title="Không đủ lượt đăng tin khả dụng"
      onClose={onClose}
      closeDisabled={saving}
      footer={
        <View className="w-full gap-2">
          <ActionButton
            label={
              saving
                ? draft
                  ? 'Đang lưu nháp...'
                  : 'Đang gửi duyệt...'
                : draft
                  ? 'Lưu nháp & Mua gói đăng tin'
                  : 'Gửi bản sửa & Mua gói đăng tin'
            }
            busy={saving}
            onClick={onSaveAndBuy}
          />
          <ActionButton
            label={draft ? 'Lưu nháp & Mua thêm lượt' : 'Gửi bản sửa & Mua thêm lượt'}
            variant="secondary"
            disabled={saving}
            onClick={onSaveAndBuyAddon}
          />
          <ActionButton
            label={draft ? 'Chỉ lưu tin nháp (Miễn phí)' : 'Chỉ gửi bản sửa để duyệt'}
            variant="secondary"
            disabled={saving}
            onClick={onSave}
          />
          <ActionButton
            label="Ở lại chỉnh sửa tiếp"
            variant="secondary"
            disabled={saving}
            onClick={onClose}
          />
        </View>
      }>
      <View className="gap-3">
        {membership ? (
          <View className="gap-1">
            <Text className="text-sm text-foreground">
              Gói hiện tại: {getTierShortLabel(membership.tier)} • Còn {membership.remainingUses}{' '}
              lượt
            </Text>
            {!membership.unlimited ? (
              <Text className="text-sm text-secondary">
                {getAddonBalanceLabel(membership) ?? 'Lượt mua thêm: 0'}
              </Text>
            ) : null}
            {reset ? <Text className="text-sm text-secondary">{reset}</Text> : null}
          </View>
        ) : null}
        <Notice
          tone="success"
          title={
            draft
              ? 'Bản nháp và dữ liệu bạn vừa nhập vẫn được giữ nguyên!'
              : 'Dữ liệu bạn vừa nhập vẫn được giữ nguyên!'
          }
          text={
            draft
              ? 'Việc Lưu tin nháp và Chỉnh sửa tin là hoàn toàn miễn phí. Bạn có thể lưu bài đăng này dưới dạng tin nháp ngay bây giờ để không mất dữ liệu, sau đó mua thêm lượt hoặc mua, nâng cấp gói để gửi duyệt.'
              : 'Tin này không lưu nháp được. Hãy gửi bản sửa để quản trị viên duyệt (trạng thái cho thuê tiếp tục theo hồ sơ hiện tại), sau đó mua thêm lượt hoặc mua, nâng cấp gói khi cần.'
          }
        />
        <View className="gap-1 rounded-xl border border-border bg-surface p-3">
          <Text className="text-sm font-bold text-foreground">
            Các gói đăng tin linh hoạt (30 ngày):
          </Text>
          {mergeMembershipPlans(null)
            .filter((plan) => plan.priceVnd > 0)
            .map((plan) => (
              <Text key={plan.code} className="text-sm leading-6 text-secondary">
                • {plan.shortName}: {plan.publicationUses} lượt đăng / {plan.durationDays} ngày —{' '}
                {formatVndPrice(plan.priceVnd)}
              </Text>
            ))}
        </View>
      </View>
    </ModalShell>
  );
}
