// Web FormActions (edit) and WizardActions (create / duplicate) as a fixed footer.
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { LAST_STEP } from '@/lib/listing-validation';
import type { ListingSubmissionAction } from '@/services/listingCreateApi';

export default function EditorActions({
  edit,
  step,
  saving,
  savingText,
  requiresReview,
  onBack,
  onCancel,
  onNext,
  onSaveDraft,
  onSubmit,
}: {
  edit: boolean;
  step: number;
  saving: ListingSubmissionAction | null;
  /** Progress line of the running save. */
  savingText: string;
  requiresReview: boolean;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  const busy = saving !== null;
  const draft = saving === 'SAVE_DRAFT';
  const sending = saving === 'SUBMIT_FOR_REVIEW';
  const note = requiresReview
    ? 'Admin duyệt nội dung mới. Trạng thái cho thuê tiếp tục theo hồ sơ hiện tại.'
    : 'Kiểm tra kỹ các thông tin trước khi lưu nháp hoặc gửi bài đăng để kiểm duyệt.';
  return (
    <View className="gap-2 border-t border-border bg-surface px-4 pb-3 pt-3">
      {savingText ? (
        <Text accessibilityLiveRegion="polite" className="text-xs font-semibold text-primary">
          {savingText}
        </Text>
      ) : edit ? (
        <Text className="text-xs leading-5 text-muted-foreground">{note}</Text>
      ) : null}
      <View className="flex-row gap-2">
        {edit ? (
          <ActionButton label="Hủy" variant="secondary" disabled={busy} onClick={onCancel} />
        ) : (
          <ActionButton
            label="Quay lại"
            variant="secondary"
            disabled={busy || step <= 1}
            className="flex-1"
            onClick={onBack}
          />
        )}
        {requiresReview ? null : (
          <ActionButton
            label={draft ? 'Đang lưu nháp...' : 'Lưu nháp'}
            variant="secondary"
            busy={draft}
            disabled={busy}
            className="flex-1"
            onClick={onSaveDraft}
          />
        )}
        {!edit && step < LAST_STEP ? (
          <ActionButton label="Tiếp tục" disabled={busy} className="flex-1" onClick={onNext} />
        ) : (
          <ActionButton
            label={
              sending
                ? edit
                  ? 'Đang cập nhật...'
                  : 'Đang gửi duyệt...'
                : edit
                  ? 'Cập nhật & Gửi duyệt'
                  : 'Gửi duyệt'
            }
            busy={sending}
            disabled={busy}
            className="flex-1"
            onClick={onSubmit}
          />
        )}
      </View>
    </View>
  );
}
