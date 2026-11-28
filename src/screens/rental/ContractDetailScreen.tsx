// Web: components/contract/ContractDetailView.tsx (DV line numbers below).
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DepositAgreementPanel from '@/components/rental/onboarding/DepositAgreementPanel';
import RentalOnboardingPanel from '@/components/rental/onboarding/RentalOnboardingPanel';
import { useToast } from '@/components/rental/onboarding/common';
import { useViewer } from '@/components/rental/requests/useViewer';
import { AnchorProvider, useAnchorController } from '@/components/rental/contract/anchors';
import ContractAmendmentPanel, {
  AmendmentActionBar,
} from '@/components/rental/contract/ContractAmendmentPanel';
import ContractAmendmentWorkspace, {
  AmendmentEditingGuard,
  ContractTermsNotice,
  useAmendmentWorkspace,
} from '@/components/rental/contract/ContractAmendmentWorkspace';
import ContractAmenitiesSection from '@/components/rental/contract/ContractAmenitiesSection';
import ContractChargesSection from '@/components/rental/contract/ContractChargesSection';
import {
  availableTabs,
  depositCards,
  depositFacts,
  leaseSummary,
  viewerSide,
  withSavedRevision,
} from '@/components/rental/contract/contractDetailLogic';
import ContractDocumentSection from '@/components/rental/contract/ContractDocumentSection';
import ContractEquipmentSection from '@/components/rental/contract/ContractEquipmentSection';
import ContractFinancialSection from '@/components/rental/contract/ContractFinancialSection';
import ContractHandoverSection from '@/components/rental/contract/ContractHandoverSection';
import ContractHeader, { DraftActionBar } from '@/components/rental/contract/ContractHeader';
import ContractInitialPaymentSection from '@/components/rental/contract/ContractInitialPaymentSection';
import ContractLeaseSection from '@/components/rental/contract/ContractLeaseSection';
import ContractMissingFieldsNotice from '@/components/rental/contract/ContractMissingFieldsNotice';
import ContractPage from '@/components/rental/contract/ContractPage';
import ContractPartiesSection from '@/components/rental/contract/ContractPartiesSection';
import ContractPoliciesSection from '@/components/rental/contract/ContractPoliciesSection';
import ContractPropertySection from '@/components/rental/contract/ContractPropertySection';
import ContractSignaturePanel from '@/components/rental/contract/ContractSignaturePanel';
import ContractSummary from '@/components/rental/contract/ContractSummary';
import DraftActionsCard, {
  DraftConflictNotice,
} from '@/components/rental/contract/DraftActionsCard';
import EndTab, { AmendmentSlot } from '@/components/rental/contract/EndTab';
import {
  ContractFieldLegend,
  ContractSnapshotReadOnly,
  linkText,
  NoticeText,
} from '@/components/rental/contract/fields';
import HistoryTab from '@/components/rental/contract/HistoryTab';
import { DraftFieldErrors } from '@/components/rental/contract/InlineAmendmentFields';
import ListingSyncControl from '@/components/rental/contract/ListingSyncControl';
import OverviewTab from '@/components/rental/contract/OverviewTab';
import { useOnboardingNextAction } from '@/components/rental/contract/pageHooks';
import PaymentTab from '@/components/rental/contract/PaymentTab';
import {
  createSignedStateRefresh,
  createSingleFlight,
  signingSource,
  submitIfCurrent,
} from '@/components/rental/contract/signingLogic';
import SmartCaSignaturePanel from '@/components/rental/contract/SmartCaSignaturePanel';
import { useLeaseDraft } from '@/components/rental/contract/useLeaseDraft';
import {
  readSigningSource,
  SOURCE_CHANGED,
  SOURCE_CHECK_FAILED,
} from '@/components/rental/contract/useSigningConsent';
import ActionButton from '@/components/rental/shared/ActionButton';
import { Card } from '@/components/rental/shared/Card';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { LoadingBlock, PageSkeleton } from '@/components/rental/shared/StateBlocks';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import { useDialog } from '@/components/AppDialog';
import { ScreenHeader } from '@/components/Screen';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { missingRequiredInitialMeters } from '@/lib/rental/contract-initial-meters';
import {
  contractDetailPath,
  contractListPath,
  type ContractRouteQuery,
} from '@/lib/rental/contract-routes';
import {
  isPreActive,
  latestDoc as pickLatestDoc,
  POST_ACTIVE,
} from '@/lib/rental/ContractDetailView';
import { ContractDraftEditor } from '@/lib/rental/ContractDraftEditor';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import {
  contractStatus,
  describeNextAction,
  type DetailTab,
  type Role,
} from '@/lib/rental/rental-labels';
import { leaseTimeline } from '@/lib/rental/timeline';
import { resolveDetailTab } from '@/lib/rental/useDetailTab';
import { VIETNAMESE_PHONE_REGEX } from '@/lib/profile-form';
import { openSettings } from '@/lib/profile-gate-signal';
import type { RentalNavigate, RentalScreenNavProps } from '@/lib/rental-nav/routes';
import { useAgreementChangeSync } from '@/lib/rental-sync/hooks';
import { contractService } from '@/services/rental/contract.service';
import type { TermRow } from '@/types/rental/contract-amendment.type';
import type {
  ContractCompletenessResponse,
  ContractDocumentResponse,
  ContractResponse,
  SignatureStateResponse,
} from '@/types/rental/contract.type';

export type ContractDetailScreenProps = RentalScreenNavProps &
  ContractRouteQuery & {
    perspective: DashboardRole;
    contractId: string;
  };

const TITLE = 'Chi tiết hợp đồng';
const SIGNING_WAIT = 'Đang kiểm tra ngày bắt đầu thuê và trạng thái thanh toán…';

export default function ContractDetailScreen(props: ContractDetailScreenProps) {
  return <Detail key={`${props.perspective}:${props.contractId}`} {...props} />;
}

/** The web renders this section inside the amendment workspace context. */
function DocumentSection(
  props: Omit<ComponentProps<typeof ContractDocumentSection>, 'amendments'>
) {
  return <ContractDocumentSection {...props} amendments={useAmendmentWorkspace()} />;
}

function Detail({
  perspective,
  contractId,
  tab: rawTab,
  section,
  invoice,
  onBack,
  onNavigate,
}: ContractDetailScreenProps) {
  const toast = useToast();
  const viewer = useViewer();
  const { confirm } = useActionDialog();
  const showDialog = useDialog();
  // The footer and the INTERNAL panel send through this one lock.
  const [sendFlight] = useState(createSingleFlight);

  const [contract, setContract] = useState<ContractResponse | null>(null);
  const [completeness, setCompleteness] = useState<ContractCompletenessResponse | null>(null);
  const [documents, setDocuments] = useState<ContractDocumentResponse[]>([]);
  const [signatureState, setSignatureState] = useState<SignatureStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [signing, setSigning] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  const scroll = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const anchors = useAnchorController(scroll, content);

  const { isLandlord, isTenant } = viewerSide(perspective, viewer.userId, contract);
  const role: Role = isLandlord ? 'LANDLORD' : 'TENANT';
  const isDepositKind = contract?.agreementKind === 'DEPOSIT';
  const preActive = isPreActive(contract);
  const {
    view: onboarding,
    nextAction,
    error: onboardingError,
    reload: reloadOnboarding,
    accept,
  } = useOnboardingNextAction(
    contract?.rentalRequestId,
    role,
    preActive && (isLandlord || isTenant)
  );
  const nextView = describeNextAction(nextAction, role);
  const tab = resolveDetailTab(rawTab, preActive && nextView?.mine ? nextView.tab : 'overview');

  // The route holds ?tab= (web useDetailTab); the other query values are kept. Read through a ref so
  // the callbacks stay stable.
  const route = useRef({ tab, section, invoice, onNavigate });
  useEffect(() => {
    route.current = { tab, section, invoice, onNavigate };
  });
  const setTab = useCallback(
    (next: DetailTab) => {
      const current = route.current;
      current.onNavigate(
        {
          screen: 'contract-detail',
          side: perspective,
          contractId,
          tab: next,
          ...(current.section ? { section: current.section } : {}),
          ...(current.invoice ? { invoice: current.invoice } : {}),
        },
        { replace: true }
      );
    },
    [perspective, contractId]
  );
  const goTo = useCallback(
    (next: DetailTab, anchorId: string) => {
      if (route.current.tab === next) return anchors.scrollTo(anchorId);
      anchors.scrollWhenDrawn(anchorId);
      setTab(next);
    },
    [anchors, setTab]
  );

  const draft = useLeaseDraft({
    contractId,
    contract,
    isLandlord,
    signatureState,
    documents,
    onboardingStage: onboarding?.stage,
    setDocuments,
    setCompleteness,
    onSaved: (saved) => setContract((previous) => withSavedRevision(previous, saved)),
    onInvalid: (anchorId) => goTo('content', anchorId),
    onRendered: () => scroll.current?.scrollTo({ y: 0, animated: true }),
  });
  const { revision, reviewDraft, draftDirty, reset: resetDraft, loaded: loadDraft } = draft;

  // Latest values for callbacks that outlive a render.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const outer = useRef({ toast, onNavigate });
  useEffect(() => {
    outer.current = { toast, onNavigate };
  });

  const load = useCallback(async () => {
    setLoading(true);
    resetDraft();
    try {
      const c = await contractService.getContract(contractId);
      if (c.agreementKind === 'DEPOSIT' || c.agreementKind === 'WORKFLOW') {
        // Deposit/workflow documents must not load lease billing, meters or amendment tools.
        setContract(c);
        loadDraft(null, null);
        return;
      }
      const [rev, comp, docs, sigState, preview] = await Promise.all([
        contractService.getRevision(contractId),
        contractService.getCompleteness(contractId),
        contractService.getDocuments(contractId),
        contractService.getSignatureState(contractId),
        c.status === 'DRAFT' ? contractService.getPreviewStatus(contractId) : Promise.resolve(null),
      ]);
      if (!alive.current) return;
      setContract(c);
      loadDraft(rev, preview);
      setCompleteness(comp);
      setDocuments(docs);
      setSignatureState(sigState);
    } catch (err) {
      if (!alive.current) return;
      outer.current.toast.error(getApiErrorMessage(err, 'Không thể tải dữ liệu hợp đồng.'));
      outer.current.onNavigate(contractListPath(perspective), { replace: true });
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [contractId, perspective, resetDraft, loadDraft]);
  useEffect(() => {
    void load();
  }, [load]);

  // One signed-state read at a time (C-046). Only signed-state fields are written: drafts, the PDF
  // and the signer's consent survive, and the page never goes back to the skeleton (C-256).
  const signedState = useRef<ReturnType<typeof createSignedStateRefresh> | null>(null);
  useEffect(() => {
    const mine = createSignedStateRefresh(
      () =>
        Promise.all([
          contractService.getContract(contractId),
          contractService.getDocuments(contractId),
          contractService.getSignatureState(contractId),
        ]),
      ([updated, docs, state]) => {
        setContract(updated);
        setDocuments(docs);
        setSignatureState(state);
      }
    );
    signedState.current = mine;
    return () => mine.dispose();
  }, [contractId]);
  const afterUpdate = useCallback(async () => {
    try {
      await signedState.current?.refresh();
    } catch {
      // The action itself succeeded; callers must not report it as failed.
      outer.current.toast.info('Đã cập nhật, chưa tải lại được dữ liệu.');
    } finally {
      setSyncTick((n) => n + 1);
      if (preActive) void reloadOnboarding();
    }
  }, [preActive, reloadOnboarding]);
  useAgreementChangeSync(
    (id) => !id || id === contractId,
    afterUpdate,
    contract?.agreementKind !== 'DEPOSIT'
  );

  // D-020: arriving with section=monthly brings the invoices block into view, once.
  const monthlyShown = useRef(false);
  const shown = !loading && Boolean(contract && viewer.userId);
  useEffect(() => {
    if (monthlyShown.current || !shown || tab !== 'payment' || section !== 'monthly') return;
    monthlyShown.current = true;
    anchors.scrollTo('monthly-invoices');
  }, [shown, tab, section, anchors]);

  // D-032: the picked period replaces the route; the page does not move.
  const selectInvoice = useCallback(
    (invoiceId: string) => {
      monthlyShown.current = true;
      route.current.onNavigate(
        {
          screen: 'contract-detail',
          side: perspective,
          contractId,
          tab: 'payment',
          section: 'monthly',
          invoice: invoiceId,
        },
        { replace: true }
      );
    },
    [perspective, contractId]
  );

  // Field errors are shown in the content tab: bring the landlord there when a save was refused.
  const { meterErrors, feeError } = draft;
  useEffect(() => {
    if (
      reviewDraft &&
      tab !== 'content' &&
      (meterErrors.electricity || meterErrors.water || feeError)
    )
      setTab('content');
  }, [reviewDraft, tab, setTab, meterErrors, feeError]);

  async function reloadDraft() {
    if (
      !draftDirty ||
      (await confirm({
        title: 'Tải bản mới?',
        description: 'Tải bản mới và bỏ các chỉnh sửa chưa lưu trên trang này.',
        tone: 'warning',
        confirmLabel: 'Tải lại',
      }))
    )
      void load();
  }

  // Only the top screen is mounted, so leaving it drops the unsaved draft: ask first.
  // The same goes for an addendum being composed (web beforeunload).
  const [amendmentEditing, setAmendmentEditing] = useState(false);
  const leave = useCallback(
    async (go: () => void) => {
      if (
        (!draftDirty && !amendmentEditing) ||
        (await confirm({
          title: 'Rời trang?',
          description: draftDirty
            ? 'Bỏ các chỉnh sửa chưa lưu trên trang này.'
            : 'Thay đổi chưa lưu sẽ bị bỏ; bản nháp đã lưu vẫn giữ lại.',
          tone: 'warning',
          confirmLabel: 'Rời trang',
        }))
      )
        go();
    },
    [draftDirty, amendmentEditing, confirm]
  );
  const back = useCallback(() => void leave(onBack), [leave, onBack]);
  const navigate = useCallback<RentalNavigate>(
    (next, options) => {
      const samePage =
        options?.replace && next.screen === 'contract-detail' && next.contractId === contractId;
      if (samePage) onNavigate(next, options);
      else void leave(() => onNavigate(next, options));
    },
    [contractId, leave, onNavigate]
  );

  // ACTION: SEND TO TENANT
  async function handleSendToTenant() {
    if (!draft.readyToSign || draft.isRendering()) {
      toast.info(
        'Dữ liệu đã thay đổi hoặc chưa có file kết xuất. Vui lòng kết xuất file xem trước trước khi gửi.'
      );
      return;
    }
    setSending(true);
    try {
      setContract(await contractService.sendToTenant(contractId));
      setDocuments(await contractService.getDocuments(contractId));
      toast.success('Đã xác nhận nội dung và gửi hợp đồng cho người thuê.');
      void afterUpdate();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể gửi hợp đồng cho người thuê.'));
    } finally {
      setSending(false);
    }
  }

  // The footer has no consent box: what must still be current is the revision and file on screen.
  function sendFromFooter() {
    if (!contract) return;
    const { landlordId, status } = contract;
    const reviewed = signingSource(
      documents,
      { id: contractId, status, currentRevisionId: revision?.id },
      'INTERNAL',
      landlordId
    );
    void sendFlight(async () => {
      setSending(true);
      try {
        await submitIfCurrent({
          stillCurrent: async () =>
            reviewed !== null &&
            (await readSigningSource(contractId, 'INTERNAL', landlordId)) === reviewed,
          isAlive: () => alive.current,
          refuse: (reason) =>
            reason === 'unreadable'
              ? showDialog('Thông báo', SOURCE_CHECK_FAILED)
              : showDialog('Thông báo', SOURCE_CHANGED, [
                  { text: 'Đóng', style: 'cancel' },
                  { text: 'Tải lại', onPress: () => void load() },
                ]),
          action: handleSendToTenant,
        });
      } finally {
        if (alive.current) setSending(false);
      }
    });
  }

  // ACTION: TENANT CONFIRM / SIGN
  async function handleSign() {
    if (contract?.status !== 'PENDING_REVIEW') {
      toast.error('Bạn chưa thể xác nhận vì hợp đồng chưa ở trạng thái chờ ký.');
      return;
    }
    setSigning(true);
    try {
      setContract(await contractService.sign(contractId));
      toast.success('Đã xác nhận đồng ý hợp đồng. Hợp đồng đã có hiệu lực.');
      void afterUpdate();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể xác nhận ký hợp đồng.'));
    } finally {
      setSigning(false);
    }
  }

  const latestDoc = useMemo(
    () => pickLatestDoc(documents, contract?.status, draft.currentPreview, revision?.id),
    [documents, contract?.status, draft.currentPreview, revision?.id]
  );

  const frame = (body: React.ReactNode, footer?: React.ReactNode) => (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title={TITLE} onBack={back} />
      <AnchorProvider value={anchors}>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerClassName="pb-8">
          <View ref={content} collapsable={false} className="px-4 pt-3">
            {body}
          </View>
        </ScrollView>
        {footer}
      </AnchorProvider>
    </SafeAreaView>
  );

  if (loading) return frame(<PageSkeleton label="Đang tải thông tin hợp đồng" />);
  if (!contract) return frame(null);
  if (!viewer.userId) return frame(<LoadingBlock label="Đang xác thực tài khoản…" />);
  const actorId = viewer.userId;

  if (!isLandlord && !isTenant)
    return frame(
      <View className="gap-2 rounded-2xl border border-warning bg-warning-soft p-5">
        <Text className="text-sm leading-6 text-warning">
          Hợp đồng này không thuộc vai trò {perspective === 'landlord' ? 'cho thuê' : 'đi thuê'} của
          bạn.
        </Text>
        <Pressable
          onPress={() => navigate(contractListPath(perspective), { replace: true })}
          accessibilityRole="link"
          className="min-h-11 justify-center self-start">
          <Text className="text-sm font-bold text-warning underline">Về danh sách hợp đồng</Text>
        </Pressable>
      </View>
    );

  const rootId = contract.parentContractId;
  if (contract.agreementKind === 'WORKFLOW')
    return frame(
      <Card className="gap-2">
        <Text className="text-sm font-semibold text-foreground">
          Văn bản ký riêng của hồ sơ trả nhà / chấm dứt sớm
        </Text>
        <Text className="text-sm leading-6 text-muted-foreground">
          Văn bản này được xem và ký cùng hồ sơ của hợp đồng gốc, nơi có đủ nội dung và kiểm tra
          phiên bản đang áp dụng.
        </Text>
        {rootId ? (
          <Pressable
            onPress={() => navigate(contractDetailPath(perspective, rootId))}
            accessibilityRole="link"
            className="min-h-11 justify-center self-start">
            <Text className={linkText}>Mở hợp đồng gốc →</Text>
          </Pressable>
        ) : null}
      </Card>
    );

  const status = contractStatus(contract.status, isDepositKind ? 'DEPOSIT' : 'LEASE');
  const pageProps = {
    perspective,
    role,
    actorId,
    contract,
    nextAction,
    onboardingMessage: onboarding?.message,
    onboardingLoaded: Boolean(onboarding),
    onboardingError,
    onRetryOnboarding: () => void reloadOnboarding(),
    tab,
    setTab,
    goTo,
    syncTick,
    onNavigate: navigate,
  };
  const headerProps = {
    contract,
    isLandlord,
    isTenant,
    statusLabel: status.label,
    statusTone: status.tone,
    onOpenDocuments: (anchorId: string) => goTo('sign', anchorId),
  };
  const tabProps = {
    contract,
    isLandlord,
    onUpdated: afterUpdate,
    onSnapshot: accept,
    onNavigate: navigate,
  };
  const onboardingPanel = (
    sections: ComponentProps<typeof RentalOnboardingPanel>['sections'],
    hideDeposit = true
  ) => (
    <RentalOnboardingPanel
      rentalRequestId={contract.rentalRequestId}
      isLandlord={isLandlord}
      showDepositAgreement={hideDeposit ? false : undefined}
      sections={sections}
      onSnapshot={accept}
      onUpdated={afterUpdate}
      onNavigate={navigate}
    />
  );

  if (isDepositKind) {
    return frame(
      <ContractAmendmentWorkspace
        contractId={contract.id}
        actorId={actorId}
        perspective={perspective}
        enabled={false}>
        <ContractPage
          key={contract.id}
          {...pageProps}
          preActive
          available={availableTabs(contract)}
          header={
            <ContractHeader
              {...headerProps}
              revision={null}
              latestDoc={null}
              kindLabel="HĐ cọc"
              summary={<ContractSummary facts={depositFacts(onboarding)} />}
              onBackToList={() =>
                navigate({ screen: 'contract-list', side: perspective, kind: 'DEPOSIT' })
              }
            />
          }
          panels={{
            overview: (
              <OverviewTab
                role={role}
                showInvoices={false}
                cards={depositCards(status.label, onboarding)}
                onboardingSummary={onboardingPanel(['summary'])}
              />
            ),
            sign: (
              <>
                <DepositAgreementPanel
                  rentalRequestId={contract.rentalRequestId}
                  isLandlord={isLandlord}
                  onUpdated={afterUpdate}
                  onNavigate={navigate}
                />
                {onboardingPanel(['sign'])}
              </>
            ),
            payment: <PaymentTab {...tabProps} preActive invoice={invoice} />,
            end: <EndTab {...tabProps} actorId={actorId} perspective={perspective} preActive />,
            history: <HistoryTab {...tabProps} perspective={perspective} preActive />,
          }}
        />
      </ContractAmendmentWorkspace>
    );
  }
  if (!revision) return frame(null);

  const source = draft.listingSyncPreview;
  const listingSyncAction = reviewDraft ? (
    <ListingSyncControl
      contractId={contractId}
      baseRevisionId={revision.id}
      disabled={draft.reviewLocked || draft.draftBusy}
      onBusyChange={draft.setSyncingListing}
      onSelect={async (selected, notice) => {
        if (draft.isRendering()) return;
        draft.setListingSyncPreview(selected);
        await draft.render(selected, notice);
      }}
    />
  ) : undefined;
  const isDraft = contract.status === 'DRAFT' && !rootId;
  const isAmendment = contract.agreementKind === 'AMENDMENT';
  const isChild = Boolean(rootId);
  const landlord = (revision.landlord || {}) as TermRow;
  const tenant = (revision.tenant || {}) as TermRow;
  const property = (source?.terms.property ?? revision.property ?? {}) as TermRow;
  const lease = (source?.terms.lease ?? revision.lease ?? {}) as TermRow;
  const financial = (source?.terms.financial ?? revision.financial ?? {}) as TermRow;
  const amenities = (source?.terms.amenities ?? revision.amenities ?? []) as TermRow[];
  const charges = (source?.terms.charges ?? revision.charges ?? []) as TermRow[];
  const equipments = (source?.terms.equipments ?? revision.equipments ?? []) as TermRow[];
  const policies = source?.terms.policies ?? revision.policies;
  const missingMeterReadings = missingRequiredInitialMeters(
    reviewDraft
      ? { electricityInitial: draft.electricityInitial, waterInitial: draft.waterInitial }
      : revision.meters,
    draft.electricityRequired,
    draft.waterRequired
  );
  const prioritizeMeters = isDraft && missingMeterReadings.length > 0;
  const missingFieldsNotice = (
    <ContractMissingFieldsNotice
      onOpenKyc={() => void leave(() => openSettings('account-security'))}
      completeness={completeness}
      isLandlord={isLandlord}
      meterFields={reviewDraft || prioritizeMeters ? missingMeterReadings : undefined}
      hasLandlordPhone={
        reviewDraft &&
        VIETNAMESE_PHONE_REGEX.test(String(draft.draftEdits.landlord?.phone ?? '').trim())
      }
    />
  );
  const handoverSection = (
    <ContractHandoverSection
      originalElectricityInitial={String(revision.meters?.electricityInitial ?? '')}
      originalWaterInitial={String(revision.meters?.waterInitial ?? '')}
      electricityInitial={draft.electricityInitial}
      waterInitial={draft.waterInitial}
      isWaterPerPerson={draft.isWaterPerPerson}
      electricityRequired={draft.electricityRequired}
      waterRequired={draft.waterRequired}
      isDraft={isDraft}
      isLandlord={isLandlord}
      disabled={draft.reviewLocked || draft.draftBusy}
      priority={prioritizeMeters}
      missingFieldsNotice={missingFieldsNotice}
      errors={draft.meterErrors}
      onElectricityChange={draft.setElectricityInitial}
      onWaterChange={draft.setWaterInitial}
    />
  );
  const contractSections = (
    <>
      <ContractFieldLegend draft={isDraft} />
      <ContractPartiesSection landlord={landlord} tenant={tenant} />
      <ContractPropertySection property={property} />
      <ContractLeaseSection
        lease={lease}
        agreedEarlyEndExclusive={contract.agreedEarlyEndExclusive}
      />
      <ContractFinancialSection financial={financial} />
      <ContractAmenitiesSection amenities={amenities} />
      <ContractChargesSection charges={charges} />
      <ContractEquipmentSection equipments={equipments} />
      <ContractPoliciesSection
        policies={policies}
        financial={financial}
        specialTerms={revision.specialTerms}
        isDraft={isDraft}
        draft={reviewDraft ? draft.draftFields : undefined}
        draftSystemTerms={reviewDraft ? (revision.systemTerms ?? revision.specialTerms) : undefined}
        originalAdditionalTerms={revision.additionalTerms}
        draftDisabled={draft.reviewLocked || draft.draftBusy}
        feeError={draft.feeError}
        onDraftChange={draft.changePolicy}
      />
    </>
  );

  const afterEffective = !isChild && POST_ACTIVE.includes(contract.status);
  const summary = leaseSummary({
    contract,
    isLandlord,
    landlord,
    tenant,
    property,
    lease,
    financial,
  });
  const depositSigned =
    !isChild &&
    onboarding?.depositAgreementContractId &&
    onboarding.depositAgreementRequired !== false
      ? POST_ACTIVE.includes(onboarding.depositAgreementStatus ?? '')
      : undefined;
  const hidesDocument = draftDirty || draft.draftConflict;
  const cancellationRefundPending = onboarding?.stage === 'CANCELLATION_REFUND_PENDING';
  const smartCa = signatureState?.signatureMode === 'SMARTCA';
  const signingAllowed = Boolean(rootId || onboarding?.canSign);
  const blockedReason = onboarding?.message ?? SIGNING_WAIT;

  const signaturePanel =
    signatureState?.signatureMode === 'SMARTCA' ? (
      <SmartCaSignaturePanel
        contract={contract}
        signingAllowed={signingAllowed}
        blockedReason={blockedReason}
        state={signatureState}
        isLandlord={isLandlord}
        isTenant={isTenant}
        hasReadyPdf={Boolean(
          draft.readyToSign &&
          documents.some(
            (d) => d.revisionId === revision.id && d.documentType === 'PDF' && d.status === 'READY'
          )
        )}
        onUpdated={afterUpdate}
      />
    ) : (
      <ContractSignaturePanel
        contract={contract}
        signingAllowed={signingAllowed}
        blockedReason={blockedReason}
        isLandlord={isLandlord}
        isTenant={isTenant}
        canSend={Boolean(completeness?.complete && draft.readyToSign)}
        sending={sending}
        signing={signing}
        onSend={handleSendToTenant}
        onSign={handleSign}
        flight={sendFlight}
      />
    );

  const anchorLink = (anchorId: string, label: string) => (
    <Pressable
      onPress={() => anchors.scrollTo(anchorId)}
      accessibilityRole="link"
      className="min-h-11 justify-center">
      <Text className={linkText}>{label}</Text>
    </Pressable>
  );

  const header = (
    <ContractHeader
      {...headerProps}
      revision={revision}
      latestDoc={hidesDocument ? null : latestDoc}
      cancellationRefundPending={cancellationRefundPending}
      kindLabel={isAmendment ? 'Phụ lục' : 'HĐ thuê'}
      summary={<ContractSummary facts={summary.facts} />}
      onBackToList={() =>
        navigate(
          isAmendment && rootId
            ? contractDetailPath(perspective, rootId)
            : contractListPath(perspective)
        )
      }
    />
  );

  const panels = {
    overview: (
      <OverviewTab
        role={role}
        cards={summary.cards}
        showInvoices={afterEffective}
        timeline={isChild ? undefined : leaseTimeline(contract, depositSigned)}
        onboardingSummary={preActive ? onboardingPanel(['summary']) : undefined}
      />
    ),
    sign: (
      <>
        {reviewDraft ? (
          <DraftActionsCard
            dirty={draftDirty}
            conflict={draft.draftConflict}
            signatureLocked={draft.signatureLocked}
            missingMeters={missingMeterReadings.length > 0}
            onReviewContent={() => setTab('content')}
            onReload={() => void reloadDraft()}
          />
        ) : null}
        {missingFieldsNotice}
        {isTenant && isDraft ? (
          <PolicyNotice
            title="Bản nháp hợp đồng"
            summary="Bản nháp để xem trước · Chưa có hiệu lực">
            <NoticeText>
              Chủ nhà vẫn có thể cập nhật nội dung. Bạn có thể xem văn bản và đề nghị nhận nhà, bắt
              đầu hợp đồng sớm trong mục Thanh toán & cọc. Chấp nhận đề nghị sẽ đổi ngày thuê và các
              kỳ hóa đơn; không chỉ mở ký trước ngày thuê cũ.
            </NoticeText>
          </PolicyNotice>
        ) : null}
        {preActive ? onboardingPanel(['sign'], false) : null}
        {rootId ? (
          <View className="gap-1">
            <PolicyNotice
              tone="info"
              title={isAmendment ? 'Phụ lục hợp đồng' : 'Văn bản gia hạn hợp đồng'}
              summary={
                isAmendment
                  ? 'Phụ lục này ghi nhận điều khoản đã thống nhất với ngày áp dụng riêng.'
                  : 'Đây là văn bản gia hạn liên kết hợp đồng gốc.'
              }>
              <NoticeText>
                {isAmendment
                  ? 'Phụ lục này ghi nhận điều khoản đã thống nhất với ngày áp dụng riêng. Xem bảng thay đổi và PDF trước khi ký. Hợp đồng gốc và lịch sử thanh toán được giữ nguyên.'
                  : 'Đây là văn bản gia hạn liên kết hợp đồng gốc. Không thu lại cọc hoặc tiền thuê tháng đầu; giữ nguyên điều kiện đã chốt. Chỉ có hiệu lực sau đủ chữ ký hai bên.'}
              </NoticeText>
            </PolicyNotice>
            <Pressable
              onPress={() => navigate(contractDetailPath(perspective, rootId))}
              accessibilityRole="link"
              className="min-h-11 justify-center">
              <Text className={linkText}>
                Mở hợp đồng gốc để theo dõi thời hạn, hóa đơn và cọc →
              </Text>
            </Pressable>
          </View>
        ) : null}
        {isAmendment && rootId ? (
          <ContractAmendmentPanel
            contractId={rootId}
            actorId={actorId}
            perspective={perspective}
            agreementId={contract.id}
            onNavigate={navigate}
          />
        ) : null}
        {signaturePanel}
        <DocumentSection documents={documents} contract={contract} onNavigate={navigate} />
      </>
    ),
    payment: (
      <PaymentTab
        {...tabProps}
        revision={revision}
        preActive={preActive}
        invoice={invoice}
        onSelectInvoice={selectInvoice}
        onTerminated={() => void load()}
        initialPayment={
          <ContractInitialPaymentSection
            initialPayment={revision.initialPayment as TermRow | undefined}
          />
        }
      />
    ),
    end: <EndTab {...tabProps} actorId={actorId} perspective={perspective} preActive={preActive} />,
    content: (
      <>
        {reviewDraft ? (
          <>
            <Card className="gap-3">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                Rà soát bản nháp trước khi ký
              </Text>
              <PolicyNotice
                tone="info"
                title="Soạn bản nháp hợp đồng"
                summary="Kiểm tra và sửa trực tiếp các ô bên dưới.">
                <NoticeText>
                  Kiểm tra và sửa trực tiếp các ô bên dưới. Bấm{' '}
                  <Text className="font-bold">Lưu</Text> để lưu bản nháp và tự tạo PDF xem trước.
                </NoticeText>
              </PolicyNotice>
              <View className="flex-row flex-wrap gap-x-5">
                {anchorLink('contract-handover', 'Chỉ số điện nước')}
                {anchorLink('contract-parties', 'Thông tin hai bên')}
                {anchorLink('contract-property', 'Thông tin địa điểm thuê')}
                {anchorLink('contract-policies', 'Phí chậm trả & thỏa thuận')}
              </View>
              {draftDirty ? (
                <Text accessibilityLiveRegion="polite" className="text-sm font-medium text-warning">
                  Có thay đổi chưa lưu
                </Text>
              ) : null}
              {source ? (
                <View className="gap-2">
                  <Text className="text-sm leading-6 text-foreground">
                    Đã tải dữ liệu bài đăng. Hoàn thiện các ô còn thiếu để lưu và kết xuất.
                  </Text>
                  <ActionButton
                    label="Bỏ dữ liệu vừa lấy"
                    variant="secondary"
                    disabled={draft.draftBusy || draft.reviewLocked}
                    onClick={() => draft.setListingSyncPreview(null)}
                  />
                </View>
              ) : null}
              {draft.draftConflict ? (
                <DraftConflictNotice onReload={() => void reloadDraft()} />
              ) : null}
              {draft.signatureLocked ? (
                <Text className="text-sm leading-6 text-warning">
                  Bản nháp đang xử lý chữ ký. Hãy theo dõi trạng thái ở mục Ký số & tài liệu.
                </Text>
              ) : null}
            </Card>
            {!prioritizeMeters ? missingFieldsNotice : null}
            {handoverSection}
          </>
        ) : null}
        {!reviewDraft && prioritizeMeters ? handoverSection : null}

        {isLandlord && isDraft ? (
          <PolicyNotice
            tone="neutral"
            title="Nguồn nội dung hợp đồng nháp"
            summary="Các nội dung chính lấy từ hồ sơ thuê đã chấp thuận.">
            <NoticeText>
              Ngày thuê, thời hạn, tiền thuê, tiền cọc và số người/xe lấy từ hồ sơ đã chấp thuận.
              Đổi ngày nhận nhà dùng đề nghị nhận nhà sớm trong mục Thanh toán & cọc. Các điều khoản
              sau ký được điều chỉnh qua phụ lục.
            </NoticeText>
          </PolicyNotice>
        ) : null}
        {afterEffective ? <ContractTermsNotice /> : null}
        <AmendmentSlot
          where="content"
          contractId={contract.id}
          actorId={actorId}
          perspective={perspective}
          onNavigate={navigate}
        />
        {reviewDraft ? (
          <ContractDraftEditor.Provider
            value={{
              base: draft.baseTerms,
              values: { ...draft.baseTerms, ...draft.draftEdits },
              busy: draft.reviewLocked || draft.draftBusy,
              patch: draft.patchTerms,
            }}>
            <DraftFieldErrors.Provider value={draft.fieldErrors}>
              <View accessibilityLabel="Nội dung bản nháp hợp đồng" className="gap-4">
                {contractSections}
              </View>
            </DraftFieldErrors.Provider>
          </ContractDraftEditor.Provider>
        ) : (
          contractSections
        )}
        {!reviewDraft && !prioritizeMeters ? handoverSection : null}
      </>
    ),
    history: <HistoryTab {...tabProps} perspective={perspective} preActive={preActive} />,
  };

  const footer = (
    <>
      <DraftActionBar
        contract={contract}
        completeness={completeness}
        isLandlord={isLandlord}
        hasReadyDoc={draft.documentsAvailable}
        smartCaMode={smartCa}
        cancellationRefundPending={cancellationRefundPending}
        rendering={draft.rendering}
        reconcilingPreview={draft.reconcilingPreview}
        sending={sending}
        draftReview={
          reviewDraft
            ? {
                saving: draft.savingDraft || draft.syncingListing,
                retry: draft.retryPreview && !draftDirty,
                locked: draft.reviewLocked,
              }
            : undefined
        }
        listingSyncAction={listingSyncAction}
        onRender={() => {
          if (!reviewDraft) scroll.current?.scrollTo({ y: 0, animated: true });
          void draft.render();
        }}
        onSend={sendFromFooter}
      />
      <AmendmentActionBar />
    </>
  );

  return (
    <AmendmentEditingGuard.Provider value={setAmendmentEditing}>
      <ContractAmendmentWorkspace
        contractId={contract.id}
        actorId={actorId}
        perspective={perspective}
        enabled={afterEffective}>
        <ContractSnapshotReadOnly.Provider value={isDraft}>
          {frame(
            <ContractPage
              key={contract.id}
              {...pageProps}
              preActive={preActive}
              available={availableTabs(contract)}
              header={header}
              panels={panels}
            />,
            footer
          )}
        </ContractSnapshotReadOnly.Provider>
      </ContractAmendmentWorkspace>
    </AmendmentEditingGuard.Provider>
  );
}
