// Web app/dashboard/properties/new/ListingEditor.tsx: create (6-step wizard), edit and duplicate.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AmenitiesSection from '@/components/listing-editor/AmenitiesSection';
import BasicInfoSection from '@/components/listing-editor/BasicInfoSection';
import DescriptionSection from '@/components/listing-editor/DescriptionSection';
import DetailsSection from '@/components/listing-editor/DetailsSection';
import EditorActions from '@/components/listing-editor/EditorActions';
import { SectionNav, WizardStepper } from '@/components/listing-editor/EditorNav';
import ExpensesSection from '@/components/listing-editor/ExpensesSection';
import LocationSection from '@/components/listing-editor/LocationSection';
import PoliciesSection from '@/components/listing-editor/PoliciesSection';
import PricingSection from '@/components/listing-editor/PricingSection';
import QuotaModal from '@/components/listing-editor/QuotaModal';
import { Notice } from '@/components/listing-editor/ui';
import { useListingEditor } from '@/components/listing-editor/useListingEditor';
import ViewingScheduleSection from '@/components/listing-editor/ViewingScheduleSection';
import MembershipCard from '@/components/listing-manage/MembershipCard';
import MembershipScreen from '@/components/membership/MembershipScreen';
import { Anchor, AnchorProvider } from '@/components/rental/contract/anchors';
import ActionButton from '@/components/rental/shared/ActionButton';
import { ScreenHeader } from '@/components/Screen';
import { startKyc, useKycBusy } from '@/lib/kyc/client';
import {
  KYC_REQUIRED_MESSAGE,
  listingLock,
  quotaSaveAction,
  requiresEditReview,
} from '@/lib/listing-editor';
import { QUOTA_BANNER } from '@/lib/listing-quota';
import {
  firstInvalidStep,
  isSinglePage,
  LAST_STEP,
  STEP_SECTIONS,
  type ListingSectionId,
} from '@/lib/listing-validation';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { useOnboarding } from '@/lib/use-onboarding';

const COPY = {
  create: {
    title: 'Đăng tin cho thuê',
    subtitle:
      'Nhập đầy đủ thông tin để tạo tin đăng cho thuê chuyên nghiệp và tiếp cận hàng ngàn khách hàng tiềm năng.',
    loading: 'Đang tải biểu mẫu đăng tin...',
  },
  edit: {
    title: 'Chỉnh sửa tin đăng',
    subtitle:
      'Cập nhật lại các thông tin của tin đăng để đảm bảo tính chính xác và thu hút khách thuê.',
    loading: 'Đang tải thông tin tin đăng để chỉnh sửa...',
  },
  duplicate: {
    title: 'Nhân bản tin đăng',
    subtitle:
      'Xem lại và điều chỉnh thông tin cần thiết (mã phòng, tầng, giá, ảnh...) để tạo tin mới nhanh chóng.',
    loading: 'Đang nạp dữ liệu từ tin đăng gốc để nhân bản...',
  },
};

/** Full screen instead of the form: loading, load error, lock or gate. */
function Blocked({
  title,
  onBack,
  heading,
  message,
  children,
}: {
  title: string;
  onBack: () => void;
  heading?: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView contentContainerClassName="gap-3 px-5 py-10">
        {heading ? (
          <Text
            accessibilityRole="header"
            className="text-center text-lg font-bold text-foreground">
            {heading}
          </Text>
        ) : null}
        <Text className="text-center text-sm leading-6 text-muted-foreground">{message}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return open;
}

export default function ListingDraftScreen({
  listingId,
  duplicateFromId,
  onBack,
  onSaved,
  onViewListing,
  onDuplicate,
  onOpenMembership = onBack,
  onManageListings = onBack,
}: {
  listingId?: string;
  /** Create a new listing prefilled from this one. */
  duplicateFromId?: string;
  onBack: () => void;
  onSaved: () => void;
  /** Actions of the locked-listing screen; the buttons are hidden without them. */
  onViewListing?: (listingId: string) => void;
  onDuplicate?: (listingId: string) => void;
  /** Leaves the editor for the membership screen; `addon` opens the extra-use purchase. */
  onOpenMembership?: (addon?: boolean) => void;
  /** The listing list; pass it when `onBack` returns somewhere else. */
  onManageListings?: () => void;
}) {
  const editor = useListingEditor({
    listingId,
    duplicateFromId,
    onBack,
    onSaved,
    onOpenMembership,
  });
  const postGate = useFeatureGate(PERMISSIONS.LISTING_POST);
  const { onboarding } = useOnboarding();
  const kycBusy = useKycBusy();
  const keyboardOpen = useKeyboardOpen();
  const [activeSection, setActiveSection] = useState<ListingSectionId>('basic-info');
  const offsets = useRef(new Map<ListingSectionId, number>());
  const { data, state, step, errors, saving, update } = editor;
  const mode = listingId ? 'edit' : duplicateFromId ? 'duplicate' : 'create';
  const copy = COPY[mode];

  // Over the editor: this component stays mounted, so the unsaved form is kept.
  if (editor.buying)
    return (
      <MembershipScreen
        initialAddon={editor.buying === 'addon'}
        onBack={editor.closeBuying}
        onCreateListing={editor.closeBuying}
        onManageListings={() => {
          editor.closeBuying();
          editor.leaveTo(onManageListings);
        }}
      />
    );

  const lock = data && state ? listingLock(data.session, state.basicInfo.title) : null;
  if (lock)
    return (
      <Blocked title={copy.title} onBack={onBack} heading={lock.title} message={lock.message}>
        {onDuplicate ? (
          <ActionButton
            label="Nhân bản thành tin mới"
            icon="copy-outline"
            onClick={() => onDuplicate(data!.session.listingId!)}
          />
        ) : null}
        {onViewListing ? (
          <ActionButton
            label="Xem chi tiết tin"
            variant="secondary"
            onClick={() => onViewListing(data!.session.listingId!)}
          />
        ) : null}
        <ActionButton label="Quay lại danh sách tin" variant="secondary" onClick={onBack} />
      </Blocked>
    );

  const kycMissing = editor.kycNeeded || Boolean(onboarding?.missing.includes('KYC'));
  if (!postGate.allowed || editor.kycNeeded)
    return (
      <Blocked
        title={copy.title}
        onBack={editor.exit}
        heading={editor.kycNeeded && postGate.allowed ? 'Cần xác minh danh tính' : undefined}
        message={postGate.title ?? KYC_REQUIRED_MESSAGE}>
        {kycMissing ? (
          <ActionButton label="Xác minh danh tính" busy={kycBusy} onClick={() => void startKyc()} />
        ) : null}
        <ActionButton
          label="Quay lại danh sách tin đăng"
          variant="secondary"
          onClick={editor.exit}
        />
      </Blocked>
    );

  if (editor.loadError)
    return (
      <Blocked
        title={copy.title}
        onBack={onBack}
        heading="Không thể tải dữ liệu tin đăng"
        message={editor.loadError}>
        <ActionButton label="Quay lại danh sách tin đăng" onClick={onBack} />
      </Blocked>
    );

  if (!data || !state)
    return (
      <Blocked title={copy.title} onBack={onBack} message={copy.loading}>
        <ActivityIndicator accessibilityLabel={copy.loading} className="text-primary" />
      </Blocked>
    );

  const { session, branches, savedAddress } = data;
  const edit = session.mode === 'edit';
  const singlePage = isSinglePage(session.mode, step);
  const sectionIds = STEP_SECTIONS[edit ? LAST_STEP : step];
  const shared = { state, update, errors };
  const newFiles = [...state.basicInfo.images, ...state.basicInfo.videos].filter((m) => m.file);
  const uploaded = newFiles.filter((m) => m.storageObjectId).length;
  const progress =
    editor.savingText && newFiles.length
      ? `${editor.savingText} (đã tải ${uploaded}/${newFiles.length} tệp)`
      : editor.savingText;

  function renderSection(id: ListingSectionId) {
    switch (id) {
      case 'basic-info':
        return (
          <BasicInfoSection
            {...shared}
            mode={session.mode}
            branches={branches}
            saving={saving !== null}
            onSelectBranch={editor.chooseBranch}
            onRequestCategory={(category) => void editor.requestCategory(category)}
          />
        );
      case 'details':
        return <DetailsSection {...shared} furnishings={editor.catalog?.furnishings ?? []} />;
      case 'amenities':
        return <AmenitiesSection {...shared} options={editor.catalog?.amenities ?? []} />;
      case 'policies':
        return (
          <PoliciesSection
            {...shared}
            definitions={editor.catalog?.policies ?? []}
            catalogError={editor.catalogError}
            onRetry={editor.retryCatalog}
          />
        );
      case 'monthly-expenses':
        return <ExpensesSection {...shared} storedCharges={session.chargeBaseline?.charges} />;
      case 'pricing':
        return <PricingSection {...shared} />;
      case 'location':
        return <LocationSection {...shared} savedAddress={savedAddress} />;
      case 'viewing-schedule':
        return <ViewingScheduleSection {...shared} />;
      case 'description':
        return (
          <DescriptionSection
            {...shared}
            generating={editor.generating}
            onGenerate={() => void editor.generateDescription()}
          />
        );
    }
  }

  function trackSection({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
    const atEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 8;
    const passed = sectionIds.filter(
      (id) => (offsets.current.get(id) ?? Infinity) <= contentOffset.y + 80
    );
    setActiveSection(
      atEnd ? sectionIds[sectionIds.length - 1] : (passed[passed.length - 1] ?? sectionIds[0])
    );
  }

  const back = () => {
    if (!edit && step > 1) editor.goToStep(step - 1);
    else editor.exit();
  };

  return (
    // Same keyboard behaviour as the shared ModalShell.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScreenHeader title={copy.title} onBack={back} />
        {singlePage ? (
          <SectionNav
            active={activeSection}
            onSelect={(id) => {
              Keyboard.dismiss();
              setActiveSection(id);
              editor.anchors.scrollTo(`section-${id}`);
            }}
          />
        ) : null}
        <AnchorProvider value={editor.anchors}>
          <ScrollView
            ref={editor.scrollRef}
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            onScroll={singlePage ? trackSection : undefined}
            scrollEventThrottle={100}>
            <View
              ref={editor.contentRef}
              collapsable={false}
              pointerEvents={saving ? 'none' : 'auto'}
              className={`gap-4 px-4 pb-8 pt-4 ${saving ? 'opacity-60' : ''}`}>
              {edit ? null : (
                <WizardStepper
                  step={step}
                  reachableUpTo={firstInvalidStep(state, {
                    savedAddressRefId: savedAddress?.refId,
                  })}
                  onSelect={editor.goToStep}
                  onClose={editor.exit}
                />
              )}
              {step === 1 || edit ? (
                <Text className="text-sm leading-5 text-muted-foreground">{copy.subtitle}</Text>
              ) : null}
              {edit && session.pendingEdit ? (
                <Notice
                  tone="warning"
                  title="Tin đang có bản sửa chờ duyệt"
                  text="Biểu mẫu hiển thị nội dung đã được duyệt, không gồm các thay đổi đang chờ. Gửi bản mới sẽ thay thế toàn bộ bản sửa đang chờ."
                />
              ) : null}
              {edit && session.editRejectionReason ? (
                <Notice
                  tone="error"
                  title="Bản sửa trước đã bị từ chối"
                  text={session.editRejectionReason}
                />
              ) : null}
              {session.mode === 'duplicate' ? (
                <Notice
                  title={`Đang tạo tin mới từ "${session.sourceTitle || 'Tin gốc'}"`}
                  text='Tin gốc sẽ không thay đổi. Tin mới chỉ được tạo khi bạn bấm "Lưu nháp" hoặc "Gửi duyệt".'
                />
              ) : null}
              {singlePage || step === 1 ? (
                <MembershipCard
                  membership={editor.membership}
                  role={editor.role}
                  loading={editor.membershipLoading}
                  onRefresh={() => void editor.loadMembership()}
                  onManage={() => editor.openMembership(false)}
                  onBuyAddon={() => editor.openMembership(true)}
                />
              ) : null}
              {!edit && singlePage ? (
                <Notice text="Kiểm tra lại thông tin trước khi gửi, bạn có thể sửa ngay tại đây. Tin chỉ được đăng sau khi bạn gửi." />
              ) : null}
              {sectionIds.map((id) => (
                <View
                  key={id}
                  onLayout={(event) => offsets.current.set(id, event.nativeEvent.layout.y)}>
                  <Anchor id={`section-${id}`}>{renderSection(id)}</Anchor>
                </View>
              ))}
              {editor.quotaBanner ? (
                <Notice tone="warning" title={QUOTA_BANNER.title} text={QUOTA_BANNER.body}>
                  <ActionButton
                    label={QUOTA_BANNER.action}
                    variant="secondary"
                    className="mt-2"
                    onClick={editor.openQuota}
                  />
                </Notice>
              ) : null}
            </View>
          </ScrollView>
        </AnchorProvider>
        {editor.flash ? (
          <View className="px-4 py-2">
            <Notice tone={editor.flash.tone} text={editor.flash.text} onClose={editor.closeFlash} />
          </View>
        ) : null}
        {/* The footer would take most of what the keyboard leaves free. */}
        {keyboardOpen ? null : (
          <EditorActions
            edit={edit}
            step={step}
            saving={saving}
            savingText={progress}
            requiresReview={requiresEditReview(session)}
            onBack={() => editor.goToStep(step - 1)}
            onCancel={editor.exit}
            onNext={editor.next}
            onSaveDraft={() => void editor.save('SAVE_DRAFT')}
            onSubmit={() => void editor.submit()}
          />
        )}
        {editor.quotaOpen ? (
          <QuotaModal
            membership={editor.membership}
            action={quotaSaveAction(session)}
            saving={saving !== null}
            onClose={editor.closeQuota}
            onSave={() => editor.saveFromQuota()}
            onSaveAndBuy={() => editor.saveFromQuota('plan')}
            onSaveAndBuyAddon={() => editor.saveFromQuota('addon')}
          />
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
