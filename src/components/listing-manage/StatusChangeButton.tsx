// Web ListingStatusActionMenu: pick a transition, confirm it (with the optional note), send it.
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import ModalShell from '@/components/rental/shared/ModalShell';
import { apiError } from '@/lib/api-error';
import { getListingOwnerActions, listingStatus, type OwnerAction } from '@/lib/listing-manage';
import { isListingQuotaExhaustedError } from '@/lib/membership';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { changeListingStatus } from '@/services/myListingApi';

import StatusBadge from './StatusBadge';

export default function StatusChangeButton({
  listing,
  onChanged,
  onOpenMembership,
}: {
  listing: { id: string; title: string; status: string; expiresAt?: string | null };
  onChanged: () => void;
  onOpenMembership: (addon?: boolean) => void;
}) {
  const showDialog = useDialog();
  const postGate = useFeatureGate(PERMISSIONS.LISTING_POST);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<OwnerAction | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const actions = getListingOwnerActions(listing.status, listing.expiresAt);
  if (!actions.length) return null;

  function select(action: OwnerAction | null) {
    setNote('');
    setPending(action);
  }

  function close() {
    setOpen(false);
    select(null);
  }

  async function confirm(action: OwnerAction) {
    if (lock.current) return;
    lock.current = true;
    setSubmitting(true);
    try {
      await changeListingStatus(listing.id, action.targetStatus, action.noteLabel ? note : '');
      close();
      showDialog(
        'Thành công',
        `Đã chuyển trạng thái sang "${listingStatus(action.targetStatus).label}".`,
        undefined,
        'success'
      );
      onChanged();
    } catch (error) {
      if (isListingQuotaExhaustedError(error)) {
        close();
        showDialog(
          'Không đủ lượt đăng tin khả dụng',
          'Thao tác đăng lại hoặc gửi duyệt lại tin đăng yêu cầu 1 lượt đăng tin khả dụng. Hiện tại tài khoản của bạn đã hết lượt gói và lượt mua thêm. Tin đăng của bạn vẫn được lưu an toàn.',
          [
            { text: 'Mua / Nâng cấp gói hội viên', onPress: () => onOpenMembership() },
            { text: 'Mua thêm lượt', onPress: () => onOpenMembership(true) },
            { text: 'Đóng', style: 'cancel' },
          ],
          'warning'
        );
      } else showDialog('Không thể đổi trạng thái tin đăng', apiError(error), undefined, 'warning');
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <ActionButton
        label="Đổi trạng thái"
        icon="options-outline"
        variant="secondary"
        hint={`Đổi trạng thái tin đăng ${listing.title}`}
        compact
        onClick={() => setOpen(true)}
      />
      {open ? (
        <ModalShell
          title={pending?.title ?? 'Đổi trạng thái tin đăng'}
          onClose={close}
          closeDisabled={submitting}
          footer={
            pending ? (
              <>
                <ActionButton
                  label="Quay lại"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => select(null)}
                />
                <ActionButton
                  label="Xác nhận"
                  variant={pending.tone}
                  busy={submitting}
                  onClick={() => void confirm(pending)}
                />
              </>
            ) : undefined
          }>
          <View className="gap-3">
            <Text className="text-sm font-bold text-foreground">{listing.title}</Text>
            {pending ? (
              <>
                <Text className="text-sm leading-5 text-muted-foreground">
                  {pending.description}
                </Text>
                {pending.noteLabel ? (
                  <View className="gap-2">
                    <View className="flex-row justify-between">
                      <Text className="text-sm font-semibold text-foreground">
                        {pending.noteLabel}
                      </Text>
                      <Text className="text-xs text-muted-foreground">{note.length}/2000</Text>
                    </View>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      editable={!submitting}
                      multiline
                      maxLength={2000}
                      textAlignVertical="top"
                      accessibilityLabel={pending.noteLabel}
                      placeholder={pending.notePlaceholder}
                      className="min-h-24 rounded-xl border border-border bg-surface p-3 text-sm text-foreground placeholder:text-subtle"
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <StatusBadge status={listing.status} />
                <Text className="text-xs text-muted-foreground">
                  Chọn hành động phù hợp với tình trạng hiện tại của bài đăng.
                </Text>
                {postGate.title ? (
                  <Text accessibilityRole="alert" className="text-sm text-warning">
                    {postGate.title}
                  </Text>
                ) : null}
                {actions.map((action) => (
                  <Pressable
                    key={action.targetStatus}
                    onPress={() => select(action)}
                    disabled={!postGate.allowed}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !postGate.allowed }}
                    className={`min-h-12 flex-row items-start gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-muted ${postGate.allowed ? '' : 'opacity-50'}`}>
                    <Icon name={action.icon} size={20} className="text-primary" />
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-foreground">{action.label}</Text>
                      <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                        {action.description}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </ModalShell>
      ) : null}
    </>
  );
}
