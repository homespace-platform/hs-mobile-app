// Web components/contract/detail/UnilateralTerminationPanel.tsx.
import { useState } from 'react';
import { Text, View } from 'react-native';

import Dropdown from '@/components/Dropdown';
import ActionButton from '@/components/rental/shared/ActionButton';
import { useActionDialog, type DialogTone } from '@/components/rental/shared/ActionDialog';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { useVisiblePoll } from '@/lib/rental-sync/hooks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { vnDateTime } from '@/lib/rental/format';
import { monthlyInvoiceService } from '@/services/rental/monthly-invoice.service';
import type {
  MonthlyInvoice,
  UnilateralTerminationNotice,
} from '@/types/rental/monthly-invoice.type';

import {
  Checkbox,
  DaysInput,
  Notice,
  TextArea,
  ToneBox,
  useActionLock,
  useAlive,
  useToast,
} from './common';
import {
  daysValid,
  parseDays,
  effectiveOption,
  noteValid,
  unilateralState,
  type TerminationOption,
} from './logic';

const statusLabel: Record<UnilateralTerminationNotice['status'], string> = {
  NOTICE: 'Đã thông báo — chờ 24 giờ',
  REVIEW_REQUESTED: 'Đang chờ chủ nhà xử lý khiếu nại',
  REPLACED: 'Đã đổi phương án',
  WITHDRAWN: 'Chủ nhà đã rút quyết định',
  CANCELLED_PAID: 'Đã rút vì thanh toán được xác nhận',
  ENDED: 'Hợp đồng đã chấm dứt',
};

/** Mount with key `${invoice.id}:${notice.id ?? "new"}`: a new notice starts an empty form. */
export default function UnilateralTerminationPanel({
  invoice,
  isLandlord,
  isTenant,
  canIssue,
  refresh,
}: {
  invoice: MonthlyInvoice;
  isLandlord: boolean;
  isTenant: boolean;
  canIssue: boolean;
  refresh: () => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [option, setOption] = useState<TerminationOption>(
    invoice.canDeferToNextPeriod ? 'ROLLOVER' : 'PAYMENT_EXTENSION'
  );
  const [days, setDays] = useState('5');
  const dayCount = parseDays(days);
  const [handover, setHandover] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useActionLock();
  const isAlive = useAlive();
  const toast = useToast();
  const { confirm } = useActionDialog();
  const state = unilateralState(invoice, { isLandlord, isTenant, canIssue });
  const notice = state.notice;
  useVisiblePoll(
    () => {
      if (!lock.held) void refresh();
    },
    30_000,
    state.poll
  );
  if (!state.visible) return null;
  const selectedOption = effectiveOption(option, invoice.canDeferToNextPeriod);

  async function perform(
    action: () => Promise<unknown>,
    title: string,
    description: string,
    tone: DialogTone = 'warning'
  ) {
    if (lock.held) return;
    if (!(await confirm({ title, description, tone }))) return;
    await lock.run(async () => {
      setBusy(true);
      try {
        await action();
        if (isAlive()) toast.success('Đã cập nhật hồ sơ xử lý quá hạn.');
      } catch (error) {
        if (isAlive())
          toast.error(
            getApiErrorMessage(
              error,
              'Không thể xử lý quyết định. Vui lòng kiểm tra hồ sơ mới nhất.'
            )
          );
      } finally {
        try {
          if (isAlive()) await refresh();
        } finally {
          if (isAlive()) setBusy(false);
        }
      }
    });
  }

  return (
    <View className="gap-3 rounded-2xl border border-danger bg-surface p-4">
      <Text accessibilityRole="header" className="text-base font-bold text-danger">
        Đơn phương chấm dứt hợp đồng
      </Text>
      {notice ? (
        <View className="gap-2">
          <Text className="text-sm font-bold text-foreground">{statusLabel[notice.status]}</Text>
          <Text className="text-sm leading-6 text-foreground">Lý do: {notice.reason}</Text>
          <Text className="text-sm leading-6 text-foreground">
            Thông báo: {vnDateTime(notice.notifiedAt)}. Hạn khiếu nại xin đổi phương án:{' '}
            {vnDateTime(notice.respondBy)}.
          </Text>
          {notice.status === 'NOTICE' ? (
            <Text className="text-sm leading-6 text-secondary">
              Không cần người thuê xác nhận đồng ý. Hết 24 giờ mà không khiếu nại, hợp đồng tự chấm
              dứt. Khách đã báo chuyển tiền thì tạm dừng chờ chủ nhà xác nhận; đã xác nhận thanh
              toán thì rút quyết định.
            </Text>
          ) : null}
          {notice.requestedAt ? (
            <ToneBox tone="warning">
              <Text className="text-sm leading-6 text-warning">
                Người thuê xin{' '}
                {notice.requestedOption === 'ROLLOVER'
                  ? 'cộng nợ sang kỳ sau'
                  : `dời hạn ${notice.requestedDays} ngày`}{' '}
                lúc {vnDateTime(notice.requestedAt)}.
              </Text>
              <Text className="text-sm leading-6 text-warning">{notice.requestReason}</Text>
            </ToneBox>
          ) : null}
          {notice.status === 'REVIEW_REQUESTED' ? (
            <PolicyNotice
              tone="neutral"
              title="Khiếu nại đúng hạn"
              summary="Đã khiếu nại đúng hạn nên tạm dừng tự chấm dứt, chờ chủ nhà quyết định.">
              <Notice>
                Đã khiếu nại đúng hạn nên tạm dừng tự chấm dứt, chờ chủ nhà quyết định. Chủ nhà từ
                chối thì hợp đồng chấm dứt ngay.
              </Notice>
            </PolicyNotice>
          ) : null}
          {notice.decisionReason ? (
            <Text className="text-sm leading-6 text-foreground">
              Kết quả: {notice.decisionReason}
            </Text>
          ) : null}
          {notice.endedAt ? (
            <Text className="text-sm leading-6 text-foreground">
              Chấm dứt lúc {vnDateTime(notice.endedAt)}. Công nợ còn phải thanh toán.{' '}
              {notice.handoverAt
                ? `Đã xác nhận bàn giao lúc ${vnDateTime(notice.handoverAt)}.`
                : 'Chưa xác nhận bàn giao; tin đăng chưa được mở lại.'}
            </Text>
          ) : null}
        </View>
      ) : null}
      {state.issueForm ? (
        <View className="gap-2">
          <PolicyNotice
            tone="warning"
            title="Đơn phương chấm dứt hợp đồng"
            summary="Khách có 24 giờ để khiếu nại; nếu không, hợp đồng tự chấm dứt.">
            <Notice>
              Gửi thông báo cho người thuê trên hồ sơ. Khách có 24 giờ để khiếu nại xin cộng nợ hoặc
              dời hạn. Nếu không khiếu nại, hợp đồng tự chấm dứt; không tự coi là đã bàn giao phòng.
            </Notice>
          </PolicyNotice>
          <TextArea
            value={reason}
            onChangeText={setReason}
            maxLength={1000}
            disabled={busy}
            accessibilityLabel="Lý do đơn phương chấm dứt"
            placeholder="Lý do (10–1000 ký tự)"
          />
          <ActionButton
            label="Thông báo đơn phương chấm dứt"
            variant="danger"
            disabled={busy || !noteValid(reason)}
            onClick={() =>
              void perform(
                () => monthlyInvoiceService.issueUnilateralTermination(invoice.id, reason.trim()),
                'Gửi thông báo đơn phương chấm dứt?',
                'Hết 24 giờ không khiếu nại, hợp đồng sẽ chấm dứt; công nợ vẫn còn.',
                'danger'
              )
            }
          />
        </View>
      ) : null}
      {state.reviewForm && notice ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">
            Phương án xin chủ nhà xem xét
          </Text>
          <View className="flex-row">
            <Dropdown
              accessibilityLabel="Phương án khiếu nại"
              value={selectedOption}
              onChange={(value) => setOption(value as TerminationOption)}
              options={[
                ...(invoice.canDeferToNextPeriod
                  ? [{ id: 'ROLLOVER', label: 'Cộng dồn sang kỳ sau' }]
                  : []),
                { id: 'PAYMENT_EXTENSION', label: 'Dời hạn thanh toán' },
              ]}
            />
          </View>
          {selectedOption === 'PAYMENT_EXTENSION' ? (
            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">Số ngày xin thêm (1–30)</Text>
              <DaysInput
                value={days}
                onChange={setDays}
                disabled={busy}
                accessibilityLabel="Số ngày xin dời hạn"
              />
            </View>
          ) : null}
          <TextArea
            value={reason}
            onChangeText={setReason}
            maxLength={1000}
            disabled={busy}
            accessibilityLabel="Lý do khiếu nại xin đổi phương án"
            placeholder="Lý do xin đổi phương án (10–1000 ký tự)"
          />
          <ActionButton
            label="Khiếu nại — xin đổi phương án"
            variant="secondary"
            disabled={
              busy ||
              !noteValid(reason) ||
              (selectedOption === 'PAYMENT_EXTENSION' && !daysValid(dayCount))
            }
            onClick={() =>
              void perform(
                () =>
                  monthlyInvoiceService.requestTerminationReview(invoice.id, notice.id, {
                    expectedVersion: notice.version,
                    option: selectedOption,
                    ...(selectedOption === 'PAYMENT_EXTENSION' ? { days: dayCount } : {}),
                    reason: reason.trim(),
                  }),
                'Gửi khiếu nại xin đổi phương án?',
                'Tự chấm dứt sẽ tạm dừng để chờ chủ nhà quyết định.'
              )
            }
          />
        </View>
      ) : null}
      {state.decisionForm && notice ? (
        <View className="gap-2">
          {state.rolloverGone ? (
            <ToneBox tone="warning">
              Kỳ sau không còn nhận được công nợ. Bạn có thể rút quyết định để chọn dời hạn hoặc từ
              chối khiếu nại; không thể cộng nợ vào hóa đơn đã phát hành.
            </ToneBox>
          ) : null}
          <TextArea
            value={decisionReason}
            onChangeText={setDecisionReason}
            maxLength={1000}
            disabled={busy}
            accessibilityLabel="Lý do quyết định khiếu nại"
            placeholder="Lý do quyết định (10–1000 ký tự)"
          />
          {[true, false].map((approve) => (
            <ActionButton
              key={String(approve)}
              label={approve ? 'Đồng ý đổi phương án' : 'Từ chối — chấm dứt ngay'}
              variant={approve ? 'secondary' : 'danger'}
              disabled={busy || !noteValid(decisionReason) || (approve && state.rolloverGone)}
              onClick={() =>
                void perform(
                  () =>
                    monthlyInvoiceService.decideTerminationReview(
                      invoice.id,
                      notice.id,
                      notice.version,
                      approve,
                      decisionReason.trim()
                    ),
                  approve ? 'Đồng ý đổi phương án?' : 'Từ chối khiếu nại?',
                  approve
                    ? 'Đồng ý phương án người thuê đã xin và rút quyết định chấm dứt.'
                    : 'Từ chối khiếu nại và chấm dứt hợp đồng ngay. Công nợ vẫn còn, bàn giao được xác nhận riêng.',
                  approve ? 'warning' : 'danger'
                )
              }
            />
          ))}
        </View>
      ) : null}
      {state.withdraw && notice ? (
        <ActionButton
          label="Rút quyết định đơn phương"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void perform(
              () =>
                monthlyInvoiceService.withdrawUnilateralTermination(
                  invoice.id,
                  notice.id,
                  notice.version
                ),
              'Rút quyết định đơn phương?',
              'Hợp đồng sẽ tiếp tục như bình thường.'
            )
          }
        />
      ) : null}
      {state.handover && notice ? (
        <View className="gap-2">
          <Checkbox
            checked={handover}
            onChange={setHandover}
            disabled={busy}
            label="Tôi đã nhận lại phòng trống, chìa khóa và tài sản; đồng ý hoàn tất xử lý cọc đã thực nhận theo nhánh vi phạm."
          />
          <ActionButton
            label="Xác nhận đã nhận lại phòng"
            variant="danger"
            disabled={busy || !handover}
            onClick={() =>
              void perform(
                () =>
                  monthlyInvoiceService.completeUnilateralHandover(
                    invoice.id,
                    notice.id,
                    notice.version
                  ),
                'Xác nhận đã nhận lại phòng?',
                'Hệ thống sẽ xử lý cọc thực nhận cho chủ nhà và mở lại tin đăng.',
                'danger'
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}
