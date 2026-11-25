// hs-web-app components/rental-request/RentalRequestDetailModal.tsx. Mounted = open.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

import RentalOnboardingPanel from '@/components/rental/onboarding/RentalOnboardingPanel';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { SectionCard } from '@/components/rental/shared/Card';
import DetailTabs from '@/components/rental/shared/DetailTabs';
import InfoRow from '@/components/rental/shared/InfoRow';
import ModalShell from '@/components/rental/shared/ModalShell';
import NextActionCard, { type CardAction } from '@/components/rental/shared/NextActionCard';
import { ErrorBlock, Skeleton } from '@/components/rental/shared/StateBlocks';
import Icon from '@/components/Icon';
import { PERMISSIONS } from '@/lib/permissions';
import { DETAIL_TABS, describeNextAction, type DetailTab } from '@/lib/rental/rental-labels';
import { canCancelRentalRequest } from '@/lib/rental/rental-request-actions';
import {
  presentRentalRequest,
  transferWindowClosed,
} from '@/lib/rental/rental-request-presentation';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { useNowMs, useRentalRequestSync } from '@/lib/rental-sync/hooks';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { paymentRequestService } from '@/services/rental/payment-request.service';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';
import rentalRequestService from '@/services/rental/rental-request.service';
import type { ContractResponse } from '@/types/rental/contract.type';
import type { PaymentRequest } from '@/types/rental/payment-request.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import {
  acceptButtonLabel,
  createDetailTickets,
  DETAIL_TAB_IDS,
  detailPrimaryAction,
  footerContractLabel,
  isOwnSide,
  ONBOARDING_STATUSES,
  PANEL_SECTIONS,
  roleOf,
  type Mode,
} from './logic';
import RentalContractFallbackButton from './RentalContractFallbackButton';
import RequestDetailOverview from './RequestDetailOverview';
import RequestThumbnail from './RequestThumbnail';

const TABS = DETAIL_TABS.filter((t) => DETAIL_TAB_IDS.includes(t.id));
const WRONG_SIDE = 'Yêu cầu thuê không thuộc tài khoản hoặc vai trò đang xem.';
const stamp = (value: string) => format(new Date(value), 'HH:mm:ss, dd/MM/yyyy');

export default function RentalRequestDetailModal({
  requestId,
  userId,
  mode,
  initialDetail = null,
  linkedContract,
  holdMinutes = null,
  isProcessingAction = false,
  creatingContract = false,
  onClose,
  onAccept,
  onReject,
  onCancel,
  onPay,
  onOpenContract,
  onOpenListing,
  onCreateDraft,
  onPaymentStatusChange,
  onNavigate,
}: {
  requestId: string;
  userId: string | null;
  mode: Mode;
  /** Detail already loaded and ownership-verified (notification link); skips the duplicate GET. */
  initialDetail?: RentalRequestResponse | null;
  linkedContract?: ContractResponse | null;
  holdMinutes?: number | null;
  isProcessingAction?: boolean;
  creatingContract?: boolean;
  onClose: () => void;
  onAccept: (request: RentalRequestResponse) => void;
  onReject: (request: RentalRequestResponse) => void;
  onCancel: (request: RentalRequestResponse) => void;
  onPay: (request: RentalRequestResponse) => void;
  onOpenContract: (contractId: string) => void;
  onOpenListing: (listingId: string) => void;
  onCreateDraft: (request: RentalRequestResponse) => void;
  onPaymentStatusChange: () => void;
  onNavigate: RentalNavigate;
}) {
  const manageGate = useFeatureGate(PERMISSIONS.RENTAL_REQUEST_MANAGE);
  const contractGate = useFeatureGate(PERMISSIONS.CONTRACT_MANAGE);
  const role = roleOf(mode);
  const nowMs = useNowMs();
  const [detail, setDetail] = useState<RentalRequestResponse | null>(null);
  const [onboarding, setOnboarding] = useState<RentalOnboarding | null>(null);
  const [detailedPayment, setDetailedPayment] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('overview');
  const autoTabbed = useRef(false);
  const alive = useRef(true);
  const tickets = useRef(createDetailTickets());

  const loadDetailedPayment = useCallback(async (id: string) => {
    try {
      setDetailedPayment(await paymentRequestService.getInitialPaymentByRentalRequestId(id));
    } catch {
      setDetailedPayment(null);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const ticket = tickets.current.open();
    setError(null);

    if (initialDetail?.id === requestId && isOwnSide(initialDetail, mode, userId)) {
      setDetail(initialDetail);
      setLoading(false);
      if (ONBOARDING_STATUSES.includes(initialDetail.status))
        void loadDetailedPayment(initialDetail.id);
      return () => {
        alive.current = false;
      };
    }

    let mounted = true;
    setLoading(true);
    rentalRequestService
      .getRequestById(requestId)
      .then((res) => {
        // A fresher silent refresh already applied: drop this older GET.
        if (!mounted || !tickets.current.isNewer(ticket)) return;
        if (!isOwnSide(res, mode, userId)) return setError(WRONG_SIDE);
        tickets.current.apply(ticket);
        setDetail(res);
        if (ONBOARDING_STATUSES.includes(res.status)) void loadDetailedPayment(res.id);
      })
      .catch(() => {
        if (mounted && tickets.current.isNewer(ticket))
          setError('Không thể tải chi tiết yêu cầu thuê. Vui lòng thử lại.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      alive.current = false;
    };
  }, [requestId, initialDetail, userId, mode, loadDetailedPayment]);

  // Silent refresh on rental-request notifications: the panel and its forms stay mounted.
  const refreshDetail = useCallback(async () => {
    const ticket = tickets.current.next();
    const fresh = await rentalRequestService.getRequestById(requestId);
    if (!alive.current || !tickets.current.isNewer(ticket) || !isOwnSide(fresh, mode, userId))
      return;
    tickets.current.apply(ticket);
    setDetail(fresh);
    if (ONBOARDING_STATUSES.includes(fresh.status)) await loadDetailedPayment(requestId);
  }, [requestId, mode, userId, loadDetailedPayment]);
  useRentalRequestSync(refreshDetail, { enabled: !!userId, requestId });

  // Open once on the section that holds the viewer's next step.
  const snapshot = useCallback(
    (view: RentalOnboarding) => {
      setOnboarding(view);
      if (autoTabbed.current) return;
      autoTabbed.current = true;
      const next = describeNextAction(view.nextAction, roleOf(mode));
      if (next?.mine && next.tab !== 'overview') setTab(next.tab);
    },
    [mode]
  );

  const retry = () => {
    setLoading(true);
    setError(null);
    rentalRequestService
      .getRequestById(requestId)
      .then((res) => (isOwnSide(res, mode, userId) ? setDetail(res) : setError(WRONG_SIDE)))
      .catch(() => setError('Không thể tải chi tiết yêu cầu thuê.'))
      .finally(() => setLoading(false));
  };

  const currentPaymentStatus = detailedPayment?.status || detail?.initialPayment?.status;
  const p = detail
    ? presentRentalRequest({
        role,
        request: detail,
        contract: linkedContract,
        livePaymentStatus: currentPaymentStatus,
        stage: onboarding?.stage,
        paymentLapsed: transferWindowClosed(detailedPayment ?? detail.initialPayment, nowMs),
      })
    : null;
  const hasPanel = !!detail && ONBOARDING_STATUSES.includes(detail.status);
  const nextView = describeNextAction(onboarding?.nextAction, role);
  const holdText = holdMinutes ? `${holdMinutes} phút` : null;

  // The next step's button. Pending requests are answered inline.
  const action = detailPrimaryAction({
    status: detail?.status,
    mode,
    nextAction: onboarding?.nextAction,
    tab,
    hasOnboarding: !!onboarding,
    phase: p?.phase,
  });
  let primary: CardAction | undefined;
  let secondary: CardAction[] = [];
  if (detail && action?.kind === 'respond') {
    const disabled = isProcessingAction || !manageGate.allowed;
    primary = { label: acceptButtonLabel(holdText), onClick: () => onAccept(detail), disabled };
    secondary = [{ label: 'Từ chối', onClick: () => onReject(detail), disabled }];
  } else if (action?.kind === 'goto') {
    primary = { label: 'Đi tới mục xử lý', onClick: () => setTab(action.tab) };
  } else if (detail && action?.kind === 'pay') {
    primary = { label: 'Thanh toán', onClick: () => onPay(detail) };
  }

  const shown = !loading && !error && detail && p ? detail : null;
  const canCancel =
    !!detail && canCancelRentalRequest(detail, linkedContract, currentPaymentStatus, role);

  const timeline = detail ? (
    <SectionCard title="Tiến độ yêu cầu">
      <View>
        <InfoRow
          label="Thời điểm gửi yêu cầu"
          value={
            detail.createdAt
              ? `${stamp(detail.createdAt)} (${formatDistanceToNow(new Date(detail.createdAt), { addSuffix: true, locale: vi })})`
              : '—'
          }
        />
        {detail.acceptedAt ? (
          <InfoRow label="Thời điểm chấp thuận" value={stamp(detail.acceptedAt)} stacked />
        ) : null}
        {detail.updatedAt && detail.updatedAt !== detail.createdAt ? (
          <InfoRow label="Cập nhật lần cuối" value={stamp(detail.updatedAt)} stacked />
        ) : null}
      </View>
    </SectionCard>
  ) : null;

  const footer = (
    <>
      <ActionButton
        label="Đóng"
        variant="secondary"
        disabled={isProcessingAction}
        onClick={onClose}
        className="grow"
      />
      {detail && !loading && canCancel ? (
        <ActionButton
          label="Hủy yêu cầu"
          variant="danger"
          disabled={isProcessingAction}
          onClick={() => onCancel(detail)}
          className="grow"
        />
      ) : null}
      {detail &&
      !loading &&
      mode === 'RECEIVED' &&
      !linkedContract &&
      detail.status === 'ACCEPTED' ? (
        <RentalContractFallbackButton
          request={detail}
          mode={mode}
          contract={linkedContract}
          view={onboarding}
          busy={creatingContract}
          disabled={isProcessingAction || !contractGate.allowed}
          onCreate={onCreateDraft}
          className="w-full"
        />
      ) : null}
      {detail && !loading && linkedContract ? (
        <ActionButton
          label={footerContractLabel(linkedContract.status, mode)}
          icon="document-text-outline"
          disabled={isProcessingAction}
          onClick={() => onOpenContract(linkedContract.id)}
          className="grow"
        />
      ) : null}
    </>
  );

  return (
    <ModalShell
      title="Chi tiết yêu cầu thuê"
      icon="document-text-outline"
      onClose={onClose}
      closeDisabled={isProcessingAction}
      footer={footer}>
      {loading ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Đang tải yêu cầu thuê"
          className="gap-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </View>
      ) : !shown || !p ? (
        <ErrorBlock
          title="Không thể tải yêu cầu"
          message={error || 'Yêu cầu thuê không tồn tại hoặc bạn không có quyền truy cập.'}
          onRetry={retry}
        />
      ) : (
        <View className="gap-4">
          {/* Which request, and where it stands */}
          <View className="flex-row gap-3">
            <RequestThumbnail
              url={shown.listingThumbnail}
              label={shown.listingTitle || 'Ảnh bài đăng'}
              className="h-20 w-20"
            />
            <View className="flex-1 gap-1.5">
              <Badge tone={p.tone} icon="ellipse">
                {p.label}
              </Badge>
              <Text className="text-lg font-bold leading-6 text-foreground">
                {shown.listingTitle}
              </Text>
              {shown.listingAddress ? (
                <View className="flex-row items-center gap-1">
                  <Icon name="location-outline" size={16} className="text-muted-foreground" />
                  <Text className="flex-1 text-sm text-muted-foreground">
                    {shown.listingAddress}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <NextActionCard
            role={role}
            nextAction={onboarding?.nextAction}
            fallbackMessage={onboarding?.message || p.hint}
            primary={primary}
            secondary={secondary}
            extra={
              action?.kind === 'respond' && manageGate.title ? (
                <Text className="text-xs text-warning">{manageGate.title}</Text>
              ) : undefined
            }
          />

          {hasPanel ? (
            <DetailTabs
              tabs={TABS.map((t) => ({
                id: t.id,
                label: t.label,
                badge: nextView?.mine && nextView.tab === t.id && t.id !== tab ? '1' : undefined,
              }))}
              active={tab}
              onChange={setTab}
              idPrefix="rr"
            />
          ) : null}

          {tab === 'overview' ? (
            <RequestDetailOverview
              detail={shown}
              mode={mode}
              payment={detailedPayment}
              holdText={holdText}
              onOpenListing={onOpenListing}
            />
          ) : null}

          {tab === 'history' || (tab === 'overview' && !hasPanel) ? timeline : null}

          {hasPanel ? (
            <RentalOnboardingPanel
              key={shown.id}
              rentalRequestId={shown.id}
              isLandlord={mode === 'RECEIVED'}
              sections={PANEL_SECTIONS[tab]}
              onSnapshot={snapshot}
              onUpdated={async () => {
                const fresh = await rentalRequestService.getRequestById(shown.id);
                setDetail(fresh);
                await loadDetailedPayment(shown.id);
                onPaymentStatusChange();
              }}
              onNavigate={onNavigate}
            />
          ) : null}
        </View>
      )}
    </ModalShell>
  );
}
