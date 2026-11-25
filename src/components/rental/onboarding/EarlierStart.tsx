// Web: components/rental-request/EarlierStart.tsx. The one earlier-start UI (request form, decision
// list, wording), used by the quick modal and by the onboarding panel.
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import type { ConfirmOptions } from '@/components/rental/shared/ActionDialog';
import Badge from '@/components/rental/shared/Badge';
import { Card } from '@/components/rental/shared/Card';
import DateField from '@/components/rental/shared/DateField';
import FieldFrame from '@/components/rental/shared/FieldFrame';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import type { Tone } from '@/lib/rental/rental-labels';
import {
  calendarDate,
  canHandleStartChange,
  canHandleStartChangeView,
  earlierStartBounds,
  isValidEarlierStart,
  startChangeStatus,
  vietnamTime,
} from '@/lib/rental/rental-start-change-quick-view';
import type {
  RentalOnboarding,
  RentalStartChange,
} from '@/services/rental/rental-onboarding.service';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

export type StartChangeAction = 'approve' | 'reject' | 'withdraw';
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const STATUS_TONE: Record<RentalStartChange['status'], Tone> = {
  REQUESTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'neutral',
  EXPIRED: 'neutral',
};

/** Same plain-words confirmation for both screens. Resolves true when the user agrees. */
export function confirmStartChange(
  confirm: ConfirmFn,
  change: RentalStartChange,
  action: StartChangeAction
) {
  if (action === 'approve')
    return confirm({
      title: `Đổi ngày bắt đầu thuê sang ${calendarDate(change.requestedDate)}?`,
      description: `Thay cho ${calendarDate(change.previousDate)}. Ngày kết thúc và các kỳ hóa đơn đổi theo ngày mới; cọc đã nhận không thu lại.`,
      confirmLabel: 'Đồng ý đổi ngày',
    });
  if (action === 'reject')
    return confirm({
      title: 'Không đồng ý đổi ngày?',
      description: 'Ngày thuê hiện tại và cọc được giữ nguyên.',
      confirmLabel: 'Không đồng ý',
      tone: 'warning',
    });
  return confirm({
    title: 'Rút đề nghị bắt đầu sớm?',
    description: 'Ngày thuê hiện tại và cọc được giữ nguyên.',
    confirmLabel: 'Rút đề nghị',
    tone: 'warning',
  });
}

export function StartChangeReview({
  request,
  view,
  actorId = null,
  mode,
  busy,
  onAction,
}: {
  request?: RentalRequestResponse;
  view: RentalOnboarding;
  actorId?: string | null;
  mode: 'RECEIVED' | 'SENT';
  busy: boolean;
  onAction: (id: string, action: StartChangeAction) => void;
}) {
  if (view.startChanges.length === 0)
    return <Text className="text-sm text-muted-foreground">Chưa có đề nghị bắt đầu sớm.</Text>;
  return (
    <View className="gap-3">
      {view.startChanges.map((change) => {
        const actionable = request
          ? canHandleStartChange(request, view, change, actorId, mode)
          : canHandleStartChangeView(view, change, mode);
        return (
          <Card key={change.id} className="gap-2">
            <Text className="text-base font-bold text-foreground">
              {calendarDate(change.previousDate)} → {calendarDate(change.requestedDate)}
            </Text>
            <Badge tone={STATUS_TONE[change.status] ?? 'neutral'}>
              {startChangeStatus[change.status] || 'Cần kiểm tra'}
            </Badge>
            <Text className="text-sm leading-6 text-foreground">{change.reason}</Text>
            <Text className="text-xs leading-5 text-muted-foreground">
              Gửi: {vietnamTime(change.requestedAt)} · Hạn phản hồi: {vietnamTime(change.respondBy)}{' '}
              (giờ Việt Nam)
            </Text>
            {change.decidedAt ? (
              <Text className="text-xs text-muted-foreground">
                Đã xử lý: {vietnamTime(change.decidedAt)}
              </Text>
            ) : null}
            {change.responseNote ? (
              <Text className="text-sm leading-6 text-foreground">{change.responseNote}</Text>
            ) : null}
            {actionable ? (
              mode === 'RECEIVED' ? (
                <>
                  <ActionButton
                    label="Đồng ý đổi ngày"
                    disabled={busy || view.stage !== 'WAITING_START'}
                    onClick={() => onAction(change.id, 'approve')}
                  />
                  <ActionButton
                    label="Không đồng ý"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onAction(change.id, 'reject')}
                  />
                </>
              ) : (
                <ActionButton
                  label="Rút đề nghị"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onAction(change.id, 'withdraw')}
                />
              )
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

/** Request form. Date bounds: not before today, strictly before the current start date. */
export function EarlierStartForm({
  view,
  busy,
  onSubmit,
  onCancel,
}: {
  view: RentalOnboarding;
  busy: boolean;
  onSubmit: (startsOn: string, reason: string) => void;
  onCancel?: () => void;
}) {
  const [startsOn, setStartsOn] = useState('');
  const [reason, setReason] = useState('');
  const { min, max } = earlierStartBounds(view);
  const valid = isValidEarlierStart(startsOn, reason, view);
  return (
    <Card className="gap-3">
      <Text accessibilityRole="header" className="text-base font-bold text-foreground">
        Đề nghị bắt đầu thuê sớm
      </Text>
      <PolicyNotice
        tone="neutral"
        title="Đề nghị bắt đầu thuê sớm"
        summary="Nếu chủ nhà đồng ý, ngày bắt đầu, ngày kết thúc và kỳ hóa đơn đổi theo ngày mới.">
        <Text className="mb-3 text-sm leading-6 text-secondary">
          Nếu được chấp nhận, ngày bắt đầu, ngày kết thúc thuê và các kỳ hóa đơn sẽ đổi theo ngày
          mới, không chỉ đổi ngày ký. Số tháng, đơn giá và cọc đã nhận được giữ nguyên.
        </Text>
        <Text className="text-sm leading-6 text-secondary">
          Hợp đồng thuê được chuẩn bị khi đã đến ngày vào và xác nhận đủ tiền thuê tháng đầu. Hồ sơ
          không yêu cầu cọc hoặc cọc 0 đồng bỏ qua hợp đồng cọc.
        </Text>
      </PolicyNotice>
      <DateField
        label="Ngày bắt đầu thuê mới"
        value={startsOn}
        onChange={setStartsOn}
        min={min}
        max={max}
        disabled={busy}
        hint={`Từ ${calendarDate(min)} đến ${calendarDate(max)}.`}
      />
      <FieldFrame label="Lý do" hint="Ít nhất 10 ký tự.">
        <TextInput
          value={reason}
          onChangeText={setReason}
          editable={!busy}
          multiline
          maxLength={1000}
          textAlignVertical="top"
          accessibilityLabel="Lý do"
          className="min-h-24 rounded-xl border border-border bg-background p-3 text-base text-foreground selection:text-primary placeholder:text-subtle"
        />
      </FieldFrame>
      <ActionButton
        label="Gửi đề nghị bắt đầu sớm"
        disabled={busy || !valid}
        onClick={() => onSubmit(startsOn, reason.trim())}
      />
      {onCancel ? (
        <ActionButton label="Đóng" variant="secondary" disabled={busy} onClick={onCancel} />
      ) : null}
    </Card>
  );
}
