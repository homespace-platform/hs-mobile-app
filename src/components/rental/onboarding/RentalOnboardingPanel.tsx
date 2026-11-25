// Web: components/rental-request/RentalOnboardingPanel.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import DepositLedgerSummary from '@/components/rental/billing/DepositLedgerSummary';
import ActionButton from '@/components/rental/shared/ActionButton';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import Accordion from '@/components/rental/shared/Accordion';
import { Card } from '@/components/rental/shared/Card';
import OnboardingStepper from '@/components/rental/shared/OnboardingStepper';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { Skeleton } from '@/components/rental/shared/StateBlocks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { readOnboarding } from '@/lib/rental/rental-onboarding-read';
import { isClosedOnboardingStage, preTenancySteps } from '@/lib/rental/rental-request-presentation';
import {
  CANCEL_RULE_ACTIVE_SUFFIX,
  CANCEL_RULES_TITLE,
  cancelRules,
  date,
  depositForfeit as isDepositForfeit,
  HISTORY_ACTIONS,
  instant,
  money,
  unreconciled as hasUnreconciled,
  visiblePayments as shownPayments,
} from '@/lib/rental/RentalOnboardingPanel';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { useRentalRequestSync } from '@/lib/rental-sync/hooks';
import paymentService from '@/services/rental/payment-request.service';
import {
  rentalOnboardingService as service,
  type RentalOnboarding,
} from '@/services/rental/rental-onboarding.service';
import storageService from '@/services/rental/storage.service';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

import { openUrl, ToneBox, useToast } from './common';
import DepositAgreementPanel from './DepositAgreementPanel';
import {
  confirmStartChange,
  EarlierStartForm,
  StartChangeReview,
  type StartChangeAction,
} from './EarlierStart';
import { defaultCaseTitle, runPanelAction } from './logic';
import OnboardingPaymentCard, { type PaymentCardAction } from './OnboardingPaymentCard';
import RentalPaymentModal from './RentalPaymentModal';
import RentalWorkflowPanel from './RentalWorkflowPanel';

/** Parts of the panel, so a page can place each in its own tab. Omit `sections` to render everything. */
export type PanelSection = 'summary' | 'sign' | 'payments' | 'end' | 'history';

export type RentalOnboardingPanelProps = {
  rentalRequestId: string;
  isLandlord?: boolean;
  onUpdated?: (view: RentalOnboarding) => void | Promise<void>;
  onSnapshot?: (view: RentalOnboarding) => void;
  showDepositAgreement?: boolean;
  sections?: PanelSection[];
  /** Mobile only: stands in for the web links inside the panel. */
  onNavigate: RentalNavigate;
};

const body = 'text-sm leading-6 text-foreground';
const policyText = 'text-sm leading-6 text-secondary';

/** The three cancel rules in plain words; the one that applies right now is highlighted. */
function CancelRules({ forfeit }: { forfeit: boolean }) {
  return (
    <View
      accessibilityLabel="Quy tắc hủy"
      className="gap-2 rounded-2xl border border-border bg-surface p-4">
      <Text accessibilityRole="header" className="text-base font-bold text-foreground">
        {CANCEL_RULES_TITLE}
      </Text>
      {cancelRules(forfeit).map((rule) => (
        <View
          key={rule.key}
          className={`rounded-xl border p-3 ${rule.active ? 'border-primary-border bg-primary-soft' : 'border-border bg-muted'}`}>
          <Text className="text-sm font-semibold leading-6 text-foreground">
            {rule.title}
            {rule.active ? CANCEL_RULE_ACTIVE_SUFFIX : ''}
          </Text>
          <Text
            className={`text-sm leading-6 ${rule.active ? 'text-primary' : 'text-muted-foreground'}`}>
            {rule.body}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Keyed by request so a new request never shows (or keeps loading) the previous one's data or form. */
export default function RentalOnboardingPanel(props: RentalOnboardingPanelProps) {
  return <RentalOnboardingPanelBody key={props.rentalRequestId} {...props} />;
}

function RentalOnboardingPanelBody({
  rentalRequestId,
  isLandlord,
  onUpdated,
  onSnapshot,
  showDepositAgreement = true,
  sections,
  onNavigate,
}: RentalOnboardingPanelProps) {
  const toast = useToast();
  const [view, setView] = useState<RentalOnboarding | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { confirm, askReason } = useActionDialog();
  const isOwner = view ? view.askerRole === 'LANDLORD' : isLandlord;
  const has = (part: PanelSection) => !sections || sections.includes(part);
  const noticeOpen = !!view && !isClosedOnboardingStage(view.stage);
  const startRequested = !!view?.startChanges.some((c) => c.status === 'REQUESTED');
  // Fully signed deposit agreement: cancelling forfeits the deposit (display only).
  const depositForfeit = isDepositForfeit(view);
  useEffect(() => {
    if (view) onSnapshot?.(view);
  }, [view, onSnapshot]);

  // One in-flight call is shared between the poll, notices, manual refresh and post-action reloads.
  // The first load and "Làm mới" use `refresh` (server syncs stages); polling and reloads only read.
  const alive = useRef(true);
  const inflight = useRef<Promise<RentalOnboarding | undefined> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(
    (sync = false) => {
      if (inflight.current) return inflight.current;
      const call = (sync ? service.refresh(rentalRequestId) : readOnboarding(rentalRequestId))
        .then((data): RentalOnboarding | undefined => {
          if (alive.current) {
            setView(data);
            setError('');
          }
          return data;
        })
        .catch((e) => {
          if (alive.current) setError(getApiErrorMessage(e, 'Chưa tải được tiến trình nhận nhà.'));
          return undefined;
        })
        .finally(() => {
          inflight.current = null;
        });
      inflight.current = call;
      return call;
    },
    [rentalRequestId]
  );
  useEffect(() => {
    void load(true);
  }, [load]);
  // Silent: only `view` changes, so an open earlier-start form and its typed values are untouched.
  const poll = useCallback(() => load(), [load]);
  useRentalRequestSync(poll, { requestId: rentalRequestId, pollMs: 15000 });

  const action = (task: () => Promise<unknown>) =>
    runPanelAction<RentalOnboarding>(actionLock, task, {
      setBusy,
      waitInflight: async () => inflight.current,
      reload: () => load(),
      onUpdated,
      closeForm: () => setShowForm(false),
      notify: toast,
    });

  async function proof(storageObjectId: string) {
    try {
      await openUrl(await storageService.getPaymentProofViewUrl(storageObjectId));
    } catch {
      toast.error('Không mở được chứng từ.');
    }
  }

  async function onPaymentAction(
    kind: PaymentCardAction,
    p: PaymentRequest,
    evidenceStorageId?: string
  ) {
    if (kind === 'pay') return setPaymentId(p.id);
    if (kind === 'proof') return void (evidenceStorageId && proof(evidenceStorageId));
    if (kind === 'confirm') {
      if (
        await confirm({
          title: 'Xác nhận đã nhận đủ tiền?',
          description: `Bạn xác nhận đã nhận đủ ${money(p.totalAmount)} vào tài khoản. Báo chuyển chưa có nghĩa đã nhận tiền.`,
          confirmLabel: 'Đã nhận đủ tiền',
        })
      )
        void action(() => paymentService.confirmReceipt(p.id));
    } else if (kind === 'reject') {
      const note = await askReason({
        title: 'Chưa nhận đủ tiền / từ chối chứng từ',
        label: 'Lý do',
        minLength: 1,
        tone: 'warning',
        confirmLabel: 'Gửi lý do',
        description: 'Bên chuyển tiền sẽ nhận được lý do này.',
      });
      if (note) void action(() => paymentService.rejectReceipt(p.id, { reason: note }));
    } else if (kind === 'reviewOk') {
      const note = await askReason({
        title: 'Xác nhận đã nhận đủ tiền',
        label: 'Ghi chú đối soát',
        minLength: 10,
        confirmLabel: 'Xác nhận đã nhận đủ',
        description: 'Ghi rõ bạn đã đối chiếu tài khoản và thực nhận đủ tiền.',
      });
      if (note) void action(() => service.review(rentalRequestId, p.id, true, note));
    } else if (kind === 'reviewReopen') {
      const note = await askReason({
        title: 'Chưa nhận tiền, mở lại thanh toán',
        label: 'Ghi chú',
        minLength: 10,
        tone: 'warning',
        confirmLabel: 'Mở lại thanh toán',
        description: 'Ghi rõ chưa nhận được tiền; người thuê được mở lại hạn thanh toán.',
      });
      if (note) void action(() => service.review(rentalRequestId, p.id, false, note));
    }
  }

  async function onStartChange(id: string, kind: StartChangeAction) {
    const change = view?.startChanges.find((c) => c.id === id);
    if (!change || !(await confirmStartChange(confirm, change, kind))) return;
    void action(() =>
      kind === 'withdraw'
        ? service.withdraw(rentalRequestId, id)
        : service.decide(rentalRequestId, id, kind === 'approve')
    );
  }

  async function requestCancel() {
    const note = await askReason({
      title: depositForfeit ? 'Hủy và mất tiền cọc?' : 'Đề nghị hủy và hoàn tiền',
      tone: depositForfeit ? 'danger' : 'warning',
      minLength: 10,
      label: 'Lý do hủy',
      confirmLabel: depositForfeit ? 'Đề nghị hủy (mất cọc)' : 'Gửi đề nghị hủy',
      description: depositForfeit
        ? 'Hợp đồng cọc đã đủ chữ ký: tiền cọc không được hoàn, chỉ hoàn tiền thuê tháng đầu nếu chủ nhà đã nhận. Nếu có lỗi hoặc tranh chấp, bạn vẫn có thể gửi khiếu nại.'
        : 'Chủ nhà sẽ quyết định. Nếu đồng ý, toàn bộ khoản đã xác nhận được hoàn lại cho bạn.',
    });
    if (note) void action(() => service.cancel(rentalRequestId, note));
  }
  async function approveCancel() {
    const ok = await confirm({
      title: depositForfeit ? 'Đồng ý hủy và giữ tiền cọc?' : 'Đồng ý hủy và hoàn tiền?',
      tone: depositForfeit ? 'danger' : 'warning',
      confirmLabel: depositForfeit ? 'Đồng ý hủy (giữ cọc)' : 'Đồng ý hủy, hoàn tiền',
      description: depositForfeit
        ? 'Hợp đồng cọc đã đủ chữ ký: tiền cọc không được hoàn, bạn giữ khoản cọc. Chỉ hoàn tiền thuê tháng đầu nếu đã nhận (bạn chuyển khoản hoàn, người thuê xác nhận).'
        : 'Bạn có nghĩa vụ hoàn toàn bộ khoản đã xác nhận: chuyển khoản hoàn và chờ người thuê xác nhận đã nhận.',
    });
    if (ok) void action(() => service.decideCancel(rentalRequestId, true));
  }
  async function disputeDefault() {
    const note = await askReason({
      title: 'Phản hồi / yêu cầu đối soát',
      minLength: 10,
      label: 'Nội dung phản hồi',
      confirmLabel: 'Gửi phản hồi',
    });
    if (note) void action(() => service.disputeDefault(rentalRequestId, note));
  }
  async function completeDefault() {
    const note = await askReason({
      title: 'Chốt giữ cọc và hủy hồ sơ',
      minLength: 10,
      maxLength: 500,
      tone: 'danger',
      label: 'Lý do chốt giữ cọc (10–500 ký tự)',
      confirmLabel: 'Tiếp tục',
    });
    if (!note) return;
    const ok = await confirm({
      title: 'Hủy hồ sơ và giữ 100% cọc?',
      tone: 'danger',
      confirmLabel: 'Tôi xác nhận, hủy hồ sơ',
      description:
        'Tôi xác nhận đã thông báo cho người thuê, đã đủ hạn phản hồi, chưa bàn giao nhà/chìa khóa và không có tranh chấp hay khoản chuyển đang chờ xác minh. Hủy hồ sơ, giữ 100% cọc thực nhận; hoàn riêng tiền thuê đã nhận.',
    });
    if (ok) void action(() => service.completeDefault(rentalRequestId, note));
  }
  async function notifyDefault() {
    const note = await askReason({
      title: 'Thông báo quá hạn trước khi xử lý cọc',
      minLength: 10,
      label: 'Nội dung thông báo cuối cùng',
      placeholder: 'Nêu nghĩa vụ quá hạn và cách liên hệ (ít nhất 10 ký tự)',
      confirmLabel: 'Tiếp tục',
    });
    if (!note) return;
    const ok = await confirm({
      title: 'Gửi thông báo cuối cùng?',
      tone: 'warning',
      confirmLabel: 'Gửi thông báo',
      description:
        'Mở thêm ít nhất 24 giờ để người thuê thanh toán, ký hoặc phản hồi. Chưa tự giữ cọc ở bước này.',
    });
    if (ok) void action(() => service.notifyDefault(rentalRequestId, note));
  }
  async function reopenSigning() {
    const note = await askReason({
      title: 'Mở lại thời hạn ký',
      minLength: 10,
      label: 'Lý do mở lại (đã kiểm tra đủ tiền)',
      confirmLabel: 'Mở lại thời hạn ký',
    });
    if (note) void action(() => service.reopenSigning(rentalRequestId, note));
  }

  // sections={[]}: a page that only wants the data (onSnapshot / onUpdated) and renders nothing.
  if (sections && sections.length === 0) return null;

  const steps =
    view && has('payments')
      ? preTenancySteps({
          ...view,
          hasRentPayment: view.payments.some((p) => p.type === 'INITIAL'),
        })
      : null;
  const unreconciled = hasUnreconciled(view);
  const visiblePayments = shownPayments(view);
  const defaultCase = view?.defaultCase;

  const content = (
    <View className="gap-4">
      {!sections ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
            Đặt cọc & nhận nhà
          </Text>
          <ActionButton
            label="Làm mới"
            icon="refresh"
            variant="secondary"
            disabled={busy}
            onClick={() => void load(true)}
          />
        </View>
      ) : null}
      {error ? (
        <ToneBox tone="warning" alert>
          {`${error} Dữ liệu đang hiển thị có thể chưa cập nhật.`}
        </ToneBox>
      ) : null}
      {!view ? (
        error ? null : (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Đang tải tiến trình"
            className="gap-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </View>
        )
      ) : (
        <>
          {has('summary') ? (
            <Card className="gap-2">
              <Text className={body}>
                Bắt đầu thuê: <Text className="font-bold">{date(view.startsOn)}</Text> · Kết thúc:{' '}
                <Text className="font-bold">{date(view.endExclusive)}</Text>{' '}
                <Text className="text-muted-foreground">(không bao gồm ngày này)</Text>
              </Text>
              {!(view.defaultCase?.completedAt && view.defaultCase.notifiedAt) ? (
                <Text className={body}>{view.message}</Text>
              ) : null}
              <Text className="text-xs text-muted-foreground">
                Cập nhật {instant(view.serverNow)} · Giờ Việt Nam
              </Text>
            </Card>
          ) : null}

          {has('sign') ? (
            view.depositAgreementRequired === false ? (
              <PolicyNotice
                tone="neutral"
                title="Không yêu cầu đặt cọc"
                summary="Không yêu cầu đặt cọc · Bỏ qua hợp đồng cọc.">
                <Text className={policyText}>
                  Không yêu cầu đặt cọc · Bỏ qua hợp đồng cọc. Thanh toán tiền thuê và ký hợp đồng
                  thuê theo tiến trình ở mục Thanh toán.
                </Text>
              </PolicyNotice>
            ) : showDepositAgreement && view.deposit ? (
              <>
                <DepositAgreementPanel
                  rentalRequestId={rentalRequestId}
                  isLandlord={!!isOwner}
                  onNavigate={onNavigate}
                  onUpdated={async () => {
                    await load();
                  }}
                />
                {view.leaseTermSource &&
                view.originalEndExclusive &&
                view.originalEndExclusive !== view.endExclusive ? (
                  <ToneBox tone="info">
                    <Text className="text-sm font-semibold text-primary">
                      Thời hạn cũ trên HĐ cọc đã được thay thế
                    </Text>
                    <PolicyNotice
                      title="Thời hạn mới thay thời hạn cũ"
                      summary={`Mốc kết thúc đổi từ ${date(view.originalEndExclusive)} sang ${date(view.endExclusive)}.`}>
                      <Text className={`mb-3 ${policyText}`}>
                        {view.leaseTermSource === 'EARLY_EXIT'
                          ? 'Phụ lục chấm dứt sớm'
                          : 'Phụ lục / văn bản gia hạn'}{' '}
                        đã ký đủ hai bên đổi mốc kết thúc từ{' '}
                        <Text className="font-bold">{date(view.originalEndExclusive)}</Text> sang{' '}
                        <Text className="font-bold">{date(view.endExclusive)}</Text> lúc 00:00
                        (không bao gồm ngày này). Thời hạn cũ không còn áp dụng.
                      </Text>
                      <Text className={policyText}>
                        Không cần ký lại HĐ cọc. Bản cọc đã ký được lưu để đối chiếu; tiền cọc tiếp
                        tục được quản lý và quyết toán theo thỏa thuận đã ký.
                      </Text>
                    </PolicyNotice>
                  </ToneBox>
                ) : null}
              </>
            ) : null
          ) : null}
          {has('sign') && view.signingDueAt && view.stage !== 'COMPLETED' ? (
            <PolicyNotice
              tone="neutral"
              title="Hạn hoàn tất ký"
              summary={`Hạn hoàn tất ký: ${instant(view.signingDueAt)}.`}>
              <Text className={policyText}>
                Hạn hoàn tất ký: {instant(view.signingDueAt)}. Quá hạn cần đối soát hồ sơ, phòng
                không tự được giải phóng.
              </Text>
            </PolicyNotice>
          ) : null}
          {has('sign') && isOwner && view.stage === 'REQUIRES_REVIEW' && view.signingDueAt ? (
            <ActionButton
              label="Đã đối soát · Mở lại thời hạn ký"
              variant="secondary"
              disabled={busy}
              onClick={() => void reopenSigning()}
            />
          ) : null}

          {has('payments') ? (
            <>
              {steps ? (
                <OnboardingStepper
                  steps={steps}
                  caption={
                    view.stage === 'AWAITING_DEPOSIT' && view.holdMinutes
                      ? `Giữ phòng ${view.holdMinutes} phút kể từ khi chủ nhà chấp thuận; cần báo chuyển khoản trước hạn ghi trên khoản thanh toán.`
                      : undefined
                  }
                />
              ) : null}
              {view.stage === 'WAITING_START' ? (
                <ToneBox tone="info">
                  <Text className="text-sm leading-6 text-primary">
                    Mở tiền tháng đầu và ký từ{' '}
                    <Text className="font-bold">{instant(view.paymentOpensAt)}</Text>.{' '}
                    {view.depositAgreementRequired === false
                      ? 'Không phát sinh khoản chuyển cọc hoặc bước ký hợp đồng cọc.'
                      : 'Cọc đã nhận được giữ riêng, không thu lại.'}
                  </Text>
                </ToneBox>
              ) : null}
              {visiblePayments.length > 0 ? (
                visiblePayments.map((p) => (
                  <OnboardingPaymentCard
                    key={p.id}
                    payment={p}
                    view={view}
                    isOwner={!!isOwner}
                    busy={busy}
                    onAction={(kind, pay, evidence) => void onPaymentAction(kind, pay, evidence)}
                  />
                ))
              ) : (
                <View className="rounded-2xl border border-dashed border-border p-4">
                  <Text className="text-sm text-muted-foreground">
                    Chưa có khoản nào cần thanh toán lúc này.
                  </Text>
                </View>
              )}
              {view.deposit ? <DepositLedgerSummary ledger={view.deposit} /> : null}
              {!isOwner && view.canRequestEarlierStart && !showForm ? (
                <ActionButton
                  label="Đề nghị nhận nhà và bắt đầu hợp đồng sớm"
                  icon="calendar-outline"
                  variant="secondary"
                  onClick={() => setShowForm(true)}
                />
              ) : null}
              {showForm ? (
                <EarlierStartForm
                  view={view}
                  busy={busy}
                  onCancel={() => setShowForm(false)}
                  onSubmit={(startsOn, reason) =>
                    void action(() => service.request(rentalRequestId, startsOn, reason))
                  }
                />
              ) : null}
              {view.startChanges.length ? (
                // Web `<details open>`: remounting on a change applies it again; the user can still toggle.
                <Accordion
                  key={String(startRequested)}
                  title={`Đề nghị bắt đầu sớm (${view.startChanges.length})`}
                  defaultOpen={startRequested}>
                  <StartChangeReview
                    view={view}
                    mode={isOwner ? 'RECEIVED' : 'SENT'}
                    busy={busy}
                    onAction={(id, kind) => void onStartChange(id, kind)}
                  />
                </Accordion>
              ) : null}
            </>
          ) : null}

          {has('end') ? (
            <>
              {noticeOpen ? <CancelRules forfeit={depositForfeit} /> : null}
              {depositForfeit && noticeOpen && view.canRequestCancellation ? (
                <PolicyNotice
                  tone="warning"
                  title="HĐ cọc đã đủ chữ ký"
                  summary="Nếu hủy, tiền cọc không được hoàn.">
                  <Text className={policyText}>
                    HĐ cọc đã đủ chữ ký: tiền cọc không được hoàn, chỉ hoàn tiền thuê tháng đầu nếu
                    đã nhận. Nếu có lỗi hoặc tranh chấp, bạn vẫn có thể gửi khiếu nại.
                  </Text>
                </PolicyNotice>
              ) : null}
              {!isOwner &&
              view.canRequestCancellation &&
              !view.cancellationRequestedAt &&
              view.stage !== 'COMPLETED' ? (
                <ActionButton
                  label={depositForfeit ? 'Đề nghị hủy (mất cọc)' : 'Đề nghị hủy và hoàn tiền'}
                  variant="danger"
                  disabled={busy}
                  onClick={() => void requestCancel()}
                />
              ) : null}
              {view.cancellationRequestedAt && view.stage === 'CANCELLATION_REQUESTED' ? (
                <Card className="gap-3">
                  <Text className="text-sm font-semibold text-foreground">
                    {isOwner
                      ? 'Người thuê đề nghị hủy hồ sơ'
                      : 'Bạn đã gửi đề nghị hủy · chờ chủ nhà quyết định'}
                  </Text>
                  <Text className={body}>{view.cancellationReason}</Text>
                  {isOwner && unreconciled ? (
                    <ToneBox tone="warning" alert>
                      Người thuê đã báo chuyển khoản nhưng bạn chưa xác nhận hoặc từ chối chứng từ.
                      Hãy xử lý chứng từ ở tab Thanh toán trước khi đồng ý hủy.
                    </ToneBox>
                  ) : null}
                  {isOwner ? (
                    <>
                      <ActionButton
                        label={depositForfeit ? 'Đồng ý hủy (giữ cọc)' : 'Đồng ý hủy, hoàn tiền'}
                        disabled={busy || unreconciled}
                        onClick={() => void approveCancel()}
                      />
                      <ActionButton
                        label="Không đồng ý hủy"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void action(() => service.decideCancel(rentalRequestId, false))
                        }
                      />
                    </>
                  ) : null}
                </Card>
              ) : null}
              {defaultCase?.notifiedAt ? (
                <ToneBox tone="warning">
                  <Text className="text-sm font-semibold leading-6 text-warning">
                    {defaultCaseTitle(defaultCase, view.stage, noticeOpen)}
                  </Text>
                  <Text className={body}>
                    {defaultCase.completedAt ? view.message : defaultCase.reason}
                  </Text>
                  <Text className="text-sm leading-6 text-warning">
                    {defaultCase.completedAt ? 'Hạn cuối đã kết thúc:' : 'Hạn cuối:'}{' '}
                    {instant(defaultCase.respondBy)} (giờ Việt Nam).
                  </Text>
                  {defaultCase.completedAt ? (
                    <Text className="text-sm leading-6 text-warning">
                      Đã hủy lúc: {instant(defaultCase.completedAt)} (giờ Việt Nam).
                    </Text>
                  ) : null}
                  {!isOwner && noticeOpen && !defaultCase.completedAt && !defaultCase.disputedAt ? (
                    <ActionButton
                      label="Phản hồi / Yêu cầu đối soát"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void disputeDefault()}
                    />
                  ) : null}
                  {defaultCase.automatic &&
                  !defaultCase.completedAt &&
                  !defaultCase.disputedAt &&
                  noticeOpen ? (
                    <Text className="text-xs font-semibold leading-5 text-warning">
                      Hệ thống tự xử lý khi hết hạn cuối nếu nghĩa vụ vẫn chưa hoàn tất và không cần
                      đối soát.
                    </Text>
                  ) : null}
                  {isOwner && !defaultCase.automatic && defaultCase.canComplete ? (
                    <ActionButton
                      label="Chốt giữ cọc & hủy hồ sơ chưa ký"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void completeDefault()}
                    />
                  ) : null}
                </ToneBox>
              ) : null}
              {isOwner &&
              !defaultCase?.automatic &&
              defaultCase?.eligibleKind &&
              !defaultCase.completedAt &&
              !defaultCase.canComplete ? (
                <ActionButton
                  label="Thông báo quá hạn trước khi xử lý cọc"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void notifyDefault()}
                />
              ) : null}
              {isOwner && !defaultCase?.policyVersion && view.stage !== 'COMPLETED' ? (
                <PolicyNotice
                  tone="neutral"
                  title="Giữ cọc khi quá hạn"
                  summary="Hồ sơ chưa ghi nhận đồng ý điều kiện giữ cọc.">
                  <Text className={policyText}>
                    Hồ sơ chưa ghi nhận đồng ý điều kiện giữ cọc trước thanh toán; không cho phép
                    chốt mất cọc tự động hay hồi tố.
                  </Text>
                </PolicyNotice>
              ) : null}
            </>
          ) : null}

          {has('history') ? (
            view.history?.length ? (
              <Card>
                <View accessibilityLabel="Lịch sử xử lý hồ sơ">
                  {view.history.map((e, index) => (
                    <View
                      key={e.id}
                      className={`gap-0.5 py-2 ${index ? 'border-t border-border' : ''}`}>
                      <Text className="text-sm font-semibold text-foreground">
                        {HISTORY_ACTIONS[e.action] ?? 'Cập nhật hồ sơ'}
                      </Text>
                      <Text className="text-xs text-muted-foreground">{instant(e.occurredAt)}</Text>
                      {e.note ? <Text className={body}>{e.note}</Text> : null}
                    </View>
                  ))}
                </View>
              </Card>
            ) : (
              <View className="rounded-2xl border border-dashed border-border p-4">
                <Text className="text-sm text-muted-foreground">
                  Chưa có hoạt động nào được ghi nhận.
                </Text>
              </View>
            )
          ) : null}
        </>
      )}
      {has('end') ? (
        <RentalWorkflowPanel
          rentalRequestId={rentalRequestId}
          kind="cancellation"
          onNavigate={onNavigate}
          onUpdated={() => load()}
        />
      ) : null}
      {paymentId ? (
        <RentalPaymentModal
          request={{ id: rentalRequestId }}
          paymentId={paymentId}
          isOpen
          onClose={() => {
            setPaymentId(null);
            void load();
          }}
          onPaymentSuccess={() => {
            setPaymentId(null);
            void load();
          }}
        />
      ) : null}
    </View>
  );

  return sections ? content : <Card>{content}</Card>;
}
