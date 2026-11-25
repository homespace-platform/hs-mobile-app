// Port of hs-web-app components/rental-request/RentalRequestsManagement.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import RentalDepositQuickViewModal from '@/components/rental/onboarding/RentalDepositQuickViewModal';
import RentalPaymentModal from '@/components/rental/onboarding/RentalPaymentModal';
import RentalStartChangeQuickModal from '@/components/rental/onboarding/RentalStartChangeQuickModal';
import RentalRequestAiReviewModal from '@/components/rental/requests/RentalRequestAiReviewModal';
import RentalRequestCard, {
  type RequestCardActions,
} from '@/components/rental/requests/RentalRequestCard';
import RentalRequestDetailModal from '@/components/rental/requests/RentalRequestDetailModal';
import RentalRequestFilters from '@/components/rental/requests/RentalRequestFilters';
import {
  emptyState,
  LIST_COPY,
  localConflicts,
  needsDeadlinePolling,
  sideOf,
} from '@/components/rental/requests/logic';
import { useContractDraft } from '@/components/rental/requests/useContractDraft';
import { useRentalHoldMinutes } from '@/components/rental/requests/useRentalHoldMinutes';
import { useRentalRequestDeepLink } from '@/components/rental/requests/useRentalRequestDeepLink';
import { useRentalRequestList } from '@/components/rental/requests/useRentalRequestList';
import { useRequestContracts } from '@/components/rental/requests/useRequestContracts';
import { useRequestDecisions } from '@/components/rental/requests/useRequestDecisions';
import { useViewer } from '@/components/rental/requests/useViewer';
import ActionButton from '@/components/rental/shared/ActionButton';
import { EmptyBlock, ErrorBlock, Skeleton } from '@/components/rental/shared/StateBlocks';
import { ScreenHeader } from '@/components/Screen';
import { PERMISSIONS } from '@/lib/permissions';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import { LIST_LOAD_ERROR } from '@/lib/rental/useRentalRequestList';
import type { RentalListMode, RentalScreenNavProps } from '@/lib/rental-nav/routes';
import { useRentalRequestSync } from '@/lib/rental-sync/hooks';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { markRentalNoticeSeen } from '@/services/managementApi';
import rentalRequestService from '@/services/rental/rental-request.service';
import type {
  RentalRequestConflict,
  RentalRequestResponse,
} from '@/types/rental/rental-request.type';

export type RentalRequestsScreenProps = RentalScreenNavProps & {
  mode: RentalListMode;
  /** ?requestId= (already a UUID). Clear it with onNavigate({ screen, mode }, { replace: true }). */
  requestId?: string;
  /** ?requestId= was not a UUID: toast DEEP_LINK_INVALID once, then clear. */
  invalidLink?: boolean;
  /** Web link to the listing page. */
  onOpenListing: (listingId: string) => void;
  /** Web link /rent in the empty state. */
  onBrowseListings: () => void;
};

/**
 * Runs after a closing modal is gone: a dialog or modal raised in the same render would be drawn in
 * (and dismissed with) the one that is closing, and iOS drops a modal opened during a dismissal.
 */
function useAfterModalClose() {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((task: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(task, 400);
  }, []);
}

function PageButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: 'chevron-back' | 'chevron-forward';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface active:bg-muted ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={18} className="text-foreground" />
    </Pressable>
  );
}

export default function RentalRequestsScreen({
  mode,
  requestId,
  invalidLink,
  onBack,
  onNavigate,
  onOpenListing,
  onBrowseListings,
}: RentalRequestsScreenProps) {
  const showDialog = useDialog();
  const viewer = useViewer();
  const { userId } = viewer;
  const manageGate = useFeatureGate(PERMISSIONS.RENTAL_REQUEST_MANAGE);
  const contractGate = useFeatureGate(PERMISSIONS.CONTRACT_MANAGE);
  const list = useRentalRequestList(mode, userId);
  const {
    requests,
    loading,
    statusFilter,
    changeFilter,
    page,
    setPage,
    totalElements,
    totalPages,
    fetchRequests,
    refreshRequests,
  } = list;
  const { contractsByRequest, agreementsByRequest, rememberContract } =
    useRequestContracts(requests);
  const holdMinutes = useRentalHoldMinutes();
  const holdLabel = holdMinutes ? `${holdMinutes} phút` : null;
  const afterModalClose = useAfterModalClose();
  const scroll = useRef<ScrollView>(null);

  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  // Detail already verified against the signed-in user by a notification link; avoids a second GET.
  const [verifiedDetail, setVerifiedDetail] = useState<RentalRequestResponse | null>(null);
  const openLinkedRequest = useCallback((request: RentalRequestResponse | null) => {
    setVerifiedDetail(request);
    setDetailRequestId(request?.id ?? null);
  }, []);
  const clearDeepLink = useRentalRequestDeepLink({
    requestId,
    invalidLink,
    userId,
    mode,
    onOpen: openLinkedRequest,
    clearParam: () => onNavigate({ screen: 'rental-requests', mode }, { replace: true }),
  });
  // Single close path: drops requestId so the same or another link can open again.
  const closeDetail = () => {
    setDetailRequestId(null);
    setVerifiedDetail(null);
    clearDeepLink();
  };
  const openDetail = (id: string) => {
    clearDeepLink();
    setVerifiedDetail(null);
    setDetailRequestId(id);
  };
  const openContract = (contractId: string) =>
    onNavigate(contractDetailPath(sideOf(mode), contractId));

  const [paymentTarget, setPaymentTarget] = useState<RentalRequestResponse | null>(null);
  const [depositQuickTarget, setDepositQuickTarget] = useState<RentalRequestResponse | null>(null);
  const [startChangeTarget, setStartChangeTarget] = useState<RentalRequestResponse | null>(null);
  // Landlord: a listing with 2+ competing pending requests shows "Hỏi AI đánh giá".
  const [conflicts, setConflicts] = useState<Record<string, RentalRequestConflict>>({});
  const [reviewTarget, setReviewTarget] = useState<RentalRequestConflict | null>(null);

  // Looking at a request (detail or a quick view) clears its "đang chờ" dot on the Quản lý tab.
  const viewedId =
    detailRequestId ?? paymentTarget?.id ?? depositQuickTarget?.id ?? startChangeTarget?.id;
  const viewed =
    verifiedDetail && verifiedDetail.id === viewedId
      ? verifiedDetail
      : requests.find((item) => item.id === viewedId);
  useEffect(() => {
    if (viewed && userId) void markRentalNoticeSeen(viewed, mode === 'RECEIVED', userId);
  }, [viewed, userId, mode]);

  const decisions = useRequestDecisions({
    mode,
    holdLabel,
    afterChange: fetchRequests,
    afterCancel: () => {
      setPaymentTarget(null);
      closeDetail();
    },
  });
  const { createDraft, creatingContractFor } = useContractDraft({
    mode,
    contractsByRequest,
    rememberContract,
    onCreated: (contractId) => {
      closeDetail();
      openContract(contractId);
    },
  });

  useEffect(() => {
    if (mode !== 'RECEIVED' || !userId) return;
    let active = true;
    rentalRequestService
      .getOwnerConflicts()
      .then((rows) => {
        if (active) setConflicts(Object.fromEntries(rows.map((row) => [row.listingId, row])));
      })
      .catch(() => {
        if (active) setConflicts(localConflicts(requests));
      });
    return () => {
      active = false;
    };
  }, [mode, requests, userId]);

  const acceptFromReview = async (id: string) => {
    const local = requests.find((item) => item.id === id);
    try {
      const request = local ?? (await rentalRequestService.getRequestById(id));
      afterModalClose(() => void decisions.accept(request));
    } catch (error) {
      showDialog(
        'Thông báo',
        getApiErrorMessage(error, 'Không mở được yêu cầu để chấp thuận. Vui lòng thử lại.')
      );
    }
  };

  // The 30 s poll and rental-request notifications share one silent refresh.
  useRentalRequestSync(refreshRequests, {
    enabled: !!userId,
    pollMs: needsDeadlinePolling(requests) ? 30000 : 0,
  });

  const actions: RequestCardActions = {
    accept: (r) => void decisions.accept(r),
    reject: (r) => void decisions.reject(r),
    cancel: (r) => void decisions.cancel(r),
    pay: setPaymentTarget,
    review: setDepositQuickTarget,
    createContract: (r) => void createDraft(r),
    openDetail: (r) => openDetail(r.id),
    openContract,
    openStartChange: setStartChangeTarget,
    askAi: setReviewTarget,
    openListing: onOpenListing,
  };

  const copy = LIST_COPY[mode];
  const empty = emptyState(statusFilter, mode);
  const goToPage = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader
        title={copy.title}
        onBack={onBack}
        icon={mode === 'RECEIVED' ? 'file-tray-full-outline' : 'send-outline'}
      />
      <ScrollView ref={scroll} contentContainerClassName="gap-4 px-4 pb-8 pt-4">
        <Text className="text-sm leading-5 text-muted-foreground">{copy.description}</Text>
        <View className="self-start">
          <ActionButton
            label="Làm mới"
            icon="refresh"
            variant="secondary"
            busy={loading && !viewer.failed}
            onClick={() => (userId ? void fetchRequests() : viewer.retry())}
          />
        </View>

        <RentalRequestFilters value={statusFilter} onChange={changeFilter} />

        {viewer.failed ? (
          <ErrorBlock message={LIST_LOAD_ERROR} />
        ) : loading ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Đang tải danh sách"
            className="gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </View>
        ) : requests.length === 0 ? (
          <EmptyBlock
            title={empty.title}
            message={empty.message}
            icon="home-outline"
            action={
              empty.action === 'all' ? (
                <ActionButton
                  label="Xem tất cả"
                  variant="secondary"
                  onClick={() => changeFilter('ALL')}
                />
              ) : empty.action === 'browse' ? (
                <ActionButton label="Tìm nhà cho thuê" icon="search" onClick={onBrowseListings} />
              ) : undefined
            }
          />
        ) : (
          <View className="gap-4">
            {requests.map((req) => (
              <RentalRequestCard
                key={req.id}
                req={req}
                mode={mode}
                contract={contractsByRequest[req.id]}
                agreement={agreementsByRequest[req.id]}
                holdLabel={holdLabel}
                conflict={conflicts[req.listingId]}
                busy={decisions.processing}
                creatingContract={creatingContractFor === req.id}
                canManage={manageGate.allowed}
                manageTitle={manageGate.title}
                canManageContract={contractGate.allowed && creatingContractFor === null}
                contractTitle={contractGate.title}
                actions={actions}
                onNavigate={onNavigate}
              />
            ))}
            {totalPages > 1 ? (
              <View accessibilityLabel="Phân trang" className="gap-2 pt-2">
                <Text className="text-center text-sm text-muted-foreground">
                  Tổng cộng {totalElements} yêu cầu
                </Text>
                <View className="flex-row items-center justify-center gap-3">
                  <PageButton
                    label="Trang trước"
                    icon="chevron-back"
                    disabled={page <= 1}
                    onPress={() => goToPage(Math.max(1, page - 1))}
                  />
                  <Text className="text-sm font-semibold text-foreground">
                    Trang {page} / {totalPages}
                  </Text>
                  <PageButton
                    label="Trang sau"
                    icon="chevron-forward"
                    disabled={page >= totalPages}
                    onPress={() => goToPage(Math.min(totalPages, page + 1))}
                  />
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {depositQuickTarget ? (
        <RentalDepositQuickViewModal
          key={depositQuickTarget.id}
          request={depositQuickTarget}
          onClose={() => setDepositQuickTarget(null)}
          onUpdated={fetchRequests}
          onOpenDetail={() => {
            const id = depositQuickTarget.id;
            setDepositQuickTarget(null);
            afterModalClose(() => openDetail(id));
          }}
        />
      ) : null}
      {startChangeTarget ? (
        <RentalStartChangeQuickModal
          key={startChangeTarget.id}
          request={startChangeTarget}
          mode={mode}
          onClose={() => setStartChangeTarget(null)}
          onUpdated={fetchRequests}
        />
      ) : null}

      {reviewTarget ? (
        <RentalRequestAiReviewModal
          key={reviewTarget.listingId}
          listingId={reviewTarget.listingId}
          listingTitle={reviewTarget.listingTitle}
          onClose={() => setReviewTarget(null)}
          onAccept={(id) => void acceptFromReview(id)}
        />
      ) : null}

      {paymentTarget ? (
        <RentalPaymentModal
          request={paymentTarget}
          isOpen
          onClose={() => setPaymentTarget(null)}
          onPaymentSuccess={() => {
            setPaymentTarget(null);
            void fetchRequests();
          }}
        />
      ) : null}

      {detailRequestId ? (
        <RentalRequestDetailModal
          key={detailRequestId}
          requestId={detailRequestId}
          userId={userId}
          mode={mode}
          initialDetail={verifiedDetail}
          linkedContract={contractsByRequest[detailRequestId]}
          isProcessingAction={decisions.processing || creatingContractFor !== null}
          creatingContract={creatingContractFor === detailRequestId}
          holdMinutes={holdMinutes}
          onClose={closeDetail}
          onCreateDraft={(r) => void createDraft(r)}
          onPaymentStatusChange={() => void fetchRequests()}
          onAccept={(r) => {
            closeDetail();
            afterModalClose(() => void decisions.accept(r));
          }}
          onReject={(r) => {
            closeDetail();
            afterModalClose(() => void decisions.reject(r));
          }}
          onCancel={(r) => {
            closeDetail();
            afterModalClose(() => void decisions.cancel(r));
          }}
          onPay={(r) => {
            closeDetail();
            afterModalClose(() => setPaymentTarget(r));
          }}
          onOpenContract={(contractId) => {
            closeDetail();
            openContract(contractId);
          }}
          onOpenListing={(listingId) => {
            closeDetail();
            onOpenListing(listingId);
          }}
          onNavigate={onNavigate}
        />
      ) : null}
    </SafeAreaView>
  );
}
