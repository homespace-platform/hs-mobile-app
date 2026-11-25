// Web components/contract/detail/OverdueActionsPanel.tsx. The legacy "early termination" block only shows
// records the server already has; nothing here proposes a new one (WD-6).
import { useState } from 'react';
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { numberVi } from '@/lib/rental/format';
import { dateTime, labels } from '@/lib/rental/OverdueActionsPanel';
import { monthlyInvoiceService } from '@/services/rental/monthly-invoice.service';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';

import { Checkbox, Notice, TextArea, ToneBox, useActionLock, useAlive, useToast } from './common';
import { dong, overdueState } from './logic';
import UnilateralTerminationPanel from './UnilateralTerminationPanel';

const LEGACY_STEPS = {
  accept: [
    'Đồng ý chấm dứt sớm?',
    'Bạn đồng ý chấm dứt hợp đồng sớm và đồng ý để chủ nhà giữ toàn bộ cọc sau khi bàn giao phòng. Hãy chỉ xác nhận khi hiểu rõ công nợ còn lại.',
  ],
  decline: [
    'Không đồng ý chấm dứt sớm?',
    'Hợp đồng tiếp tục hiệu lực; chủ nhà có thể chọn cộng dồn công nợ kỳ sau.',
  ],
  withdraw: [
    'Rút đề nghị chấm dứt?',
    'Hợp đồng tiếp tục hiệu lực; bạn có thể chọn cộng dồn công nợ kỳ sau.',
  ],
  complete: [
    'Hoàn tất chấm dứt hợp đồng?',
    'Xác nhận người thuê đã bàn giao toàn bộ phòng, chìa khóa và tài sản thuê. Thao tác này chấm dứt hợp đồng, ghi nhận toàn bộ cọc thuộc chủ nhà và mở lại bài đăng. Không thể hoàn tác trên giao diện.',
  ],
  force: [
    'Buộc chấm dứt do quá hạn?',
    'Bạn xác nhận bản hợp đồng đã ký có điều khoản chấm dứt do quá hạn và đã thực tế nhận lại phòng, chìa khóa, tài sản. Hệ thống sẽ chấm dứt hợp đồng, ghi nhận cọc cho chủ nhà và mở lại tin đăng. Không thể hoàn tác trên giao diện.',
  ],
} as const;
type LegacyStep = keyof typeof LEGACY_STEPS;

function legacyCall(step: LegacyStep, id: string) {
  const handedOver = { vacantPossessionConfirmed: true, keysAndAssetsReturned: true };
  if (step === 'accept')
    return monthlyInvoiceService.acceptTermination(id, {
      acceptEarlyTermination: true,
      acceptDepositRetention: true,
      acknowledgeOutstandingDebt: true,
    });
  if (step === 'decline') return monthlyInvoiceService.declineTermination(id);
  if (step === 'withdraw') return monthlyInvoiceService.withdrawTermination(id);
  if (step === 'force')
    return monthlyInvoiceService.forceTerminationAfterDecline(id, {
      signedClauseAcknowledged: true,
      tenantNotified: true,
      ...handedOver,
    });
  return monthlyInvoiceService.completeTermination(id, handedOver);
}

export default function OverdueActionsPanel({
  invoice,
  contractActive,
  isLandlord,
  isTenant,
  refresh,
  onTerminated,
}: {
  invoice: MonthlyInvoice;
  contractActive: boolean;
  isLandlord: boolean;
  isTenant: boolean;
  /** Re-reads the invoices and the contract around them (web reloads the page after a termination). */
  refresh: () => Promise<void>;
  /** Replaces `refresh` after "complete" / "force": the whole contract is read again. */
  onTerminated?: () => void;
}) {
  const [tenantNotes, setTenantNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const lock = useActionLock();
  const isAlive = useAlive();
  const toast = useToast();
  const { confirm } = useActionDialog();
  const [tenantConsent, setTenantConsent] = useState(false);
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);
  const [forceAcknowledged, setForceAcknowledged] = useState(false);
  const [tenantNotified, setTenantNotified] = useState(false);
  const state = overdueState(invoice, { contractActive, isLandlord, isTenant });
  if (!state.visible) return null;
  const { legacy } = state;

  const perform = (
    action: () => Promise<unknown>,
    success: string,
    failure: string,
    after: () => unknown = refresh
  ) =>
    lock.run(async () => {
      setBusy(true);
      try {
        await action();
        toast.success(success);
        await after();
      } catch (error) {
        toast.error(getApiErrorMessage(error, failure));
      } finally {
        if (isAlive()) setBusy(false);
      }
    });

  async function terminationStep(step: LegacyStep) {
    if (lock.held) return;
    const [title, description] = LEGACY_STEPS[step];
    const tone = step === 'decline' || step === 'withdraw' ? 'warning' : 'danger';
    if (!(await confirm({ title, description, tone }))) return;
    const ended = step === 'complete' || step === 'force';
    await perform(
      () => legacyCall(step, invoice.id),
      ended ? 'Đã chấm dứt hợp đồng và mở lại tin đăng.' : 'Đã ghi nhận quyết định.',
      'Không thể xử lý đề nghị chấm dứt.',
      ended ? onTerminated : undefined
    );
  }

  async function defer() {
    if (lock.held) return;
    const ok = await confirm({
      title: 'Cộng dồn công nợ sang kỳ sau?',
      description:
        'Toàn bộ công nợ và phí phạt đã chốt sẽ chuyển sang hóa đơn kỳ kế tiếp. Phí phạt dừng tăng. Khi hóa đơn mới phát hành, QR kỳ này bị hủy.',
      confirmLabel: 'Cộng dồn',
      tone: 'warning',
    });
    if (!ok) return;
    await perform(
      () => monthlyInvoiceService.deferToNextPeriod(invoice.id),
      'Đã chốt công nợ để cộng vào kỳ sau.',
      'Không thể chuyển nợ sang kỳ sau.'
    );
  }

  const acknowledge = (actionId: string) =>
    perform(
      () =>
        monthlyInvoiceService.acknowledgeOverdueAction(
          invoice.id,
          actionId,
          tenantNotes[actionId] || ''
        ),
      'Đã ghi nhận phản hồi của bạn.',
      'Không thể gửi phản hồi.'
    );

  return (
    <View className="gap-3 rounded-2xl border border-warning bg-surface p-4">
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          Xử lý hóa đơn quá hạn
        </Text>
        <PolicyNotice
          tone="warning"
          title="Quy tắc xử lý hóa đơn quá hạn"
          actionLabel="Xem quy tắc"
          summary="Sau 5 ngày quá hạn, chọn một phương án xử lý (không áp dụng hai phương án cùng lúc).">
          <View className="gap-3">
            <Notice>
              Sau khi hết 5 ngày quá hạn, chọn một phương án: cộng nợ kỳ sau, đơn phương chấm dứt
              hoặc dời hạn thanh toán ở mục gia hạn. Chọn cộng nợ/chấm dứt sẽ từ chối yêu cầu gia
              hạn đang chờ và tính bù phí. Không áp dụng hai phương án cùng lúc.
            </Notice>
            <Notice>
              Phạt tối đa 5 ngày trên mỗi hóa đơn. Hết 10 ngày quá hạn, nếu chưa chọn phương án và
              còn kỳ sau chưa phát hành, hệ thống tự chốt nợ để cộng dồn. Không tự cộng dồn khi đang
              chờ duyệt gia hạn, đối soát hoặc xử lý chấm dứt.
            </Notice>
          </View>
        </PolicyNotice>
      </View>
      {state.canDefer ? (
        <View className="gap-2 rounded-xl border border-border bg-background p-3">
          <Text className="text-sm font-bold text-foreground">
            Cho phép thanh toán trễ vào kỳ sau
          </Text>
          <Text className="text-sm leading-6 text-muted-foreground">
            Chốt {dong(invoice.totalAmount)} tại thời điểm này; hóa đơn sau cộng một dòng công nợ.
            QR cũ chỉ bị hủy khi hóa đơn mới phát hành.
          </Text>
          <ActionButton label="Cộng dồn sang kỳ sau" disabled={busy} onClick={() => void defer()} />
        </View>
      ) : null}
      {state.cannotDefer ? (
        <PolicyNotice
          tone="warning"
          title="Không thể chuyển nợ sang kỳ sau"
          summary="Không còn kỳ thuê kế tiếp chưa phát hành để chuyển nợ.">
          <Notice>
            Không còn kỳ thuê kế tiếp chưa phát hành để chuyển nợ. Cần thanh toán hóa đơn này hoặc
            xử lý chấm dứt theo thỏa thuận.
          </Notice>
        </PolicyNotice>
      ) : null}
      <UnilateralTerminationPanel
        key={`${invoice.id}:${invoice.unilateralTermination?.id ?? 'new'}`}
        invoice={invoice}
        isLandlord={isLandlord}
        isTenant={isTenant}
        canIssue={state.canPropose}
        refresh={refresh}
      />
      {legacy.open && invoice.terminationProposedAt ? (
        <View className="gap-2 rounded-xl border border-border bg-background p-3">
          <Text className="text-sm font-bold text-foreground">Đề nghị chấm dứt sớm đã gửi</Text>
          <Text className="text-sm leading-6 text-muted-foreground">
            Gửi lúc {dateTime(invoice.terminationProposedAt)}. Phòng và cọc chưa thay đổi. Công nợ
            đã phát hành vẫn được theo dõi.
          </Text>
          {invoice.terminationDeclinedAt ? (
            <Text className="text-sm leading-6 text-danger">
              Người thuê đã từ chối lúc {dateTime(invoice.terminationDeclinedAt)}; hợp đồng vẫn hiệu
              lực, cọc và tin đăng chưa đổi. Chủ nhà có thể rút đề nghị hoặc xử lý theo điều khoản
              đã ký.
            </Text>
          ) : null}
          {invoice.terminationCancelledAt ? (
            <Text className="text-sm leading-6 text-danger">
              Đề nghị đã rút hoặc hết hiệu lực lúc {dateTime(invoice.terminationCancelledAt)}; hợp
              đồng vẫn hiệu lực.
            </Text>
          ) : null}
          {legacy.tenantRespond ? (
            <View className="gap-2">
              <Checkbox
                checked={tenantConsent}
                onChange={setTenantConsent}
                disabled={busy}
                label={`Tôi đồng ý chấm dứt sớm, đồng ý chủ nhà giữ toàn bộ cọc ${numberVi(Number(invoice.originalDepositAmount || 0))} đ sau bàn giao và hiểu rằng công nợ hóa đơn chưa thanh toán vẫn cần quyết toán.`}
              />
              <ActionButton
                label="Đồng ý chấm dứt và xử lý cọc"
                variant="danger"
                disabled={busy || !tenantConsent}
                onClick={() => void terminationStep('accept')}
              />
              <ActionButton
                label="Không đồng ý"
                variant="secondary"
                disabled={busy}
                onClick={() => void terminationStep('decline')}
              />
            </View>
          ) : null}
          {legacy.landlordWithdraw ? (
            <ActionButton
              label="Rút đề nghị"
              variant="secondary"
              disabled={busy}
              onClick={() => void terminationStep('withdraw')}
            />
          ) : null}
          {legacy.force ? (
            <View className="gap-2 rounded-xl border border-danger bg-danger-soft p-3">
              <Text className="text-sm font-bold text-danger">Buộc chấm dứt do quá hạn</Text>
              {legacy.force === 'clause-missing' ? (
                <Text className="text-sm leading-6 text-danger">
                  Bản hợp đồng đã ký không có điều khoản 5 ngày theo cấu trúc hiện hành; không thể
                  áp dụng nhánh này cho hợp đồng cũ.
                </Text>
              ) : (
                <>
                  <PolicyNotice
                    tone="warning"
                    title="Điều kiện đơn phương chấm dứt"
                    summary="Chỉ thực hiện khi đã thông báo cho người thuê và thực tế lấy lại phòng.">
                    <Notice>
                      Chỉ thực hiện khi đã thông báo cho người thuê và thực tế lấy lại phòng. Không
                      mở lại tin đăng nếu người thuê chưa bàn giao.
                    </Notice>
                  </PolicyNotice>
                  <Checkbox
                    checked={forceAcknowledged}
                    onChange={setForceAcknowledged}
                    disabled={busy}
                    label="Tôi xác nhận bản hợp đồng đã ký có điều khoản chấm dứt do quá hạn."
                  />
                  <Checkbox
                    checked={tenantNotified}
                    onChange={setTenantNotified}
                    disabled={busy}
                    label="Tôi đã thông báo quyết định chấm dứt cho người thuê."
                  />
                  <Checkbox
                    checked={handoverConfirmed}
                    onChange={setHandoverConfirmed}
                    disabled={busy}
                    label="Tôi đã nhận lại phòng trống, chìa khóa và toàn bộ tài sản cho thuê."
                  />
                  <ActionButton
                    label="Buộc chấm dứt và mở lại tin đăng"
                    variant="danger"
                    disabled={busy || !forceAcknowledged || !tenantNotified || !handoverConfirmed}
                    onClick={() => void terminationStep('force')}
                  />
                </>
              )}
            </View>
          ) : null}
          {legacy.acceptedNote && invoice.terminationAcceptedAt ? (
            <Text className="text-sm leading-6 text-success">
              Người thuê đã đồng ý lúc {dateTime(invoice.terminationAcceptedAt)}. Chờ bàn giao
              phòng.
            </Text>
          ) : null}
          {legacy.complete ? (
            <View className="gap-2">
              <Checkbox
                checked={handoverConfirmed}
                onChange={setHandoverConfirmed}
                disabled={busy}
                label="Tôi xác nhận phòng đã trống, đã nhận lại chìa khóa và tài sản cho thuê."
              />
              <ActionButton
                label="Đã nhận bàn giao — hoàn tất chấm dứt"
                variant="danger"
                disabled={busy || !handoverConfirmed}
                onClick={() => void terminationStep('complete')}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {legacy.completed && invoice.terminationCompletedAt ? (
        <ToneBox tone="success">
          {`Hợp đồng đã ${invoice.terminationForcedAt ? 'được chủ nhà chấm dứt theo điều khoản quá hạn' : 'chấm dứt theo thỏa thuận'} lúc ${dateTime(invoice.terminationCompletedAt)}; cọc ${numberVi(Number(invoice.retainedDepositAmount || 0))} đ đã ghi nhận thuộc chủ nhà và tin đăng đã mở lại.`}
        </ToneBox>
      ) : null}
      {state.history.map((action) => (
        <View key={action.id} className="gap-1 rounded-xl border border-border bg-background p-3">
          <Text className="text-sm font-bold text-foreground">{labels[action.type]}</Text>
          <Text className="text-sm text-muted-foreground">
            {action.type === 'AUTOMATIC_ROLLOVER' ? 'Hệ thống ghi nhận' : 'Chủ nhà ghi nhận'} lúc{' '}
            {dateTime(action.createdAt)}
          </Text>
          {action.proposedDate ? (
            <Text className="text-sm text-foreground">
              Ngày đề xuất:{' '}
              <Text className="font-bold">
                {action.proposedDate.split('-').reverse().join('/')}
              </Text>
            </Text>
          ) : null}
          <Text className="text-sm leading-6 text-foreground">{action.note}</Text>
          {action.acknowledgedAt ? (
            <Text className="text-sm leading-6 text-success">
              Người thuê đã xem và phản hồi lúc {dateTime(action.acknowledgedAt)}
              {action.tenantAcknowledgment ? `: ${action.tenantAcknowledgment}` : '.'}
            </Text>
          ) : null}
          {isTenant && !action.acknowledgedAt ? (
            <View className="gap-2 pt-2">
              <TextArea
                value={tenantNotes[action.id] || ''}
                onChangeText={(text) =>
                  setTenantNotes((current) => ({ ...current, [action.id]: text }))
                }
                maxLength={1000}
                disabled={busy}
                accessibilityLabel="Phản hồi của bạn (không bắt buộc)"
                placeholder="Phản hồi của bạn (không bắt buộc)"
              />
              <ActionButton
                label="Xác nhận đã xem / gửi phản hồi"
                variant="secondary"
                disabled={busy}
                onClick={() => void acknowledge(action.id)}
              />
              <Text className="text-sm leading-6 text-muted-foreground">
                Xác nhận đã xem không có nghĩa bạn đồng ý gia hạn hoặc chấm dứt hợp đồng.
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
