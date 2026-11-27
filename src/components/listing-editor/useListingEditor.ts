// State of the listing editor screen: the wiring of hs-web-app ListingEditor.tsx around the
// logic modules. Rules live in @/lib/listing-*; nothing here decides what is valid or sent.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, type ScrollView, type View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import { useAnchorController } from '@/components/rental/contract/anchors';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import { startKyc, subscribeKycFinished } from '@/lib/kyc/client';
import {
  buildDescriptionRequest,
  createDescriptionJob,
  DESCRIPTION_BLOCKED_MESSAGE,
  DESCRIPTION_REPLACE_CONFIRM,
} from '@/lib/listing-description';
import { setLeaveGuard, unlessBusy } from '@/lib/leave-guard';
import {
  applyCatalog,
  editSubmitConfirm,
  listingLock,
  MAYBE_SAVED_MESSAGE,
  membershipRoute,
  quotaSaveAction,
  refreshEditSession,
  RESEND_CONFIRM,
  type QuotaPurchase,
} from '@/lib/listing-editor';
import {
  canChangeCategory,
  changeCategory,
  PROPERTY_CATEGORIES,
  selectBranch,
  type ListingFormState,
  type PropertyCategoryKey,
} from '@/lib/listing-form';
import { createLatest } from '@/lib/listing-latest';
import {
  listRooms,
  prefillRoomCode,
  readRoomLink,
  ROOM_DROPPED_MESSAGE,
  type ListingRoom,
} from '@/lib/listing-room-link';
import { markUploaded } from '@/lib/listing-media';
import { CATALOG_LOAD_FAILED, CATALOG_LOADING, catalogMessage } from '@/lib/listing-policy';
import { isOutOfQuota } from '@/lib/listing-quota';
import {
  isSinglePage,
  validateListing,
  validateStep,
  type ValidationResult,
} from '@/lib/listing-validation';
import {
  getListingCatalog,
  type ListingCatalog,
  type ListingSubmissionAction,
} from '@/services/listingCreateApi';
import { branchLayoutApi } from '@/services/branchMonitorApi';
import { getAccessibleListing } from '@/services/listingApi';
import { fetchListingDescription } from '@/services/listingDescriptionApi';
import { loadListingEditor, submitListing } from '@/services/listingEditorApi';
import { getMyMembership, type MembershipView } from '@/services/membershipApi';
import { getUserProfileApi } from '@/services/userApi';

import type { NoticeTone } from './ui';

type Loaded = Pick<
  Awaited<ReturnType<typeof loadListingEditor>>,
  'session' | 'branches' | 'savedAddress'
>;

export function useListingEditor({
  listingId,
  duplicateFromId,
  branchId,
  roomId,
  onBack,
  onSaved,
  onOpenMembership,
}: {
  listingId?: string;
  duplicateFromId?: string;
  /** With roomId, create only: the room of the branch map this listing is started from. */
  branchId?: string;
  roomId?: string;
  onBack: () => void;
  onSaved: () => void;
  /** Leaves the editor; `addon` opens the extra-use purchase. */
  onOpenMembership: (addon?: boolean) => void;
}) {
  const showDialog = useDialog();
  const { confirm } = useActionDialog();
  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<ListingFormState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [catalog, setCatalog] = useState<ListingCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(CATALOG_LOADING);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<string[] | null>(null);
  const [step, setStep] = useState(1);
  const [flash, setFlash] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [saving, setSaving] = useState<ListingSubmissionAction | null>(null);
  const [savingText, setSavingText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [membership, setMembership] = useState<MembershipView | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [kycNeeded, setKycNeeded] = useState(false);
  const [quotaBanner, setQuotaBanner] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  /** Membership shown over the editor, which keeps the unsaved form. */
  const [buying, setBuying] = useState<QuotaPurchase | null>(null);
  /** Once removed it never comes back. */
  const [roomLink, setRoomLink] = useState(() =>
    readRoomLink({ listingId, duplicateFromId, branchId, roomId })
  );
  /** null = still loading. */
  const [rooms, setRooms] = useState<ListingRoom[] | 'error' | null>(null);
  const roomRequests = useRef(createLatest());

  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const anchors = useAnchorController(scrollRef, contentRef);
  const mounted = useRef(true);
  const savingRef = useRef(false);
  const dirty = useRef(false);
  const catalogRequests = useRef(createLatest());
  // Async handlers read the form as it is now, not as it was when they were created.
  const latest = useRef({ data, state, catalog, catalogError, step, roomLink });
  latest.current = { data, state, catalog, catalogError, step, roomLink };
  const job = useRef<ReturnType<typeof createDescriptionJob> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      job.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const link = readRoomLink({ listingId, duplicateFromId, branchId, roomId });
    loadListingEditor({ listingId, duplicateFromId, branchId: link?.branchId })
      .then((result) => {
        if (!active) return;
        const { session, branches, savedAddress } = result;
        setData({ session, branches, savedAddress });
        setState(result.state);
        if (result.notice) setFlash({ tone: result.notice.type, text: result.notice.message });
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      });
    return () => {
      active = false;
    };
  }, [listingId, duplicateFromId, branchId, roomId]);

  const linkedBranchId = roomLink?.branchId;
  const loadRooms = useCallback(async () => {
    if (!linkedBranchId) return;
    const request = roomRequests.current.next();
    const result = await branchLayoutApi
      .getLayout(linkedBranchId)
      .then(listRooms, () => 'error' as const);
    if (request.isLatest()) setRooms(result);
  }, [linkedBranchId]);
  useEffect(() => {
    const requests = roomRequests.current;
    void loadRooms();
    return () => requests.abort();
  }, [loadRooms]);

  // The room's code fills an empty code field once per room and category, never the title. It is not
  // an edit by the owner, so it does not mark the form dirty.
  const roomCode =
    roomLink && Array.isArray(rooms) ? rooms.find((r) => r.id === roomLink.roomId)?.code : undefined;
  const formReady = Boolean(state);
  const formCategory = state?.basicInfo.category;
  useEffect(() => {
    if (roomCode && formReady) setState((s) => s && prefillRoomCode(s, roomCode));
  }, [roomCode, formReady, formCategory]);

  const category = state?.basicInfo.category;
  useEffect(() => {
    if (!category) return;
    const requests = catalogRequests.current;
    const request = requests.next();
    setCatalog(null);
    setCatalogError(CATALOG_LOADING);
    getListingCatalog(category).then(
      (result) => {
        if (!request.isLatest()) return;
        setCatalog(result);
        setCatalogError(catalogMessage(result.policies));
        const session = latest.current.data?.session;
        if (session) setState((s) => s && applyCatalog(s, session, result));
      },
      () => {
        if (request.isLatest()) setCatalogError(CATALOG_LOAD_FAILED);
      }
    );
    return () => requests.abort();
  }, [category, catalogRetry]);

  const loadMembership = useCallback(async () => {
    setMembershipLoading(true);
    try {
      const me = await getMyMembership();
      if (mounted.current) setMembership(me);
    } catch {
      // Display only: keep the previous value when the service is unavailable.
    } finally {
      if (mounted.current) setMembershipLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadMembership();
  }, [loadMembership]);

  const checkKyc = useCallback(async () => {
    try {
      let profile = await getUserProfileApi();
      if (!profile.kycVerified) profile = await getUserProfileApi(true);
      if (!mounted.current) return;
      setRole(profile.role ?? null);
      setKycNeeded(profile.kycVerified !== true);
    } catch {
      // Unknown: do not block here, saving checks again.
    }
  }, []);
  useEffect(() => {
    void checkKyc();
    const unsubscribe = subscribeKycFinished(() => void checkKyc());
    return () => {
      unsubscribe();
    };
  }, [checkKyc]);

  // Runs after the errors are drawn, so the positions include them.
  useEffect(() => {
    if (!focus?.length) return;
    const frame = requestAnimationFrame(() => anchors.scrollToFirst(focus));
    return () => cancelAnimationFrame(frame);
  }, [focus, anchors]);

  function update(change: (state: ListingFormState) => ListingFormState) {
    if (savingRef.current) return;
    dirty.current = true;
    setState((s) => s && change(s));
  }

  function goToStep(next: number) {
    if (savingRef.current) return;
    Keyboard.dismiss();
    setStep(next);
    setFlash(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  const singlePage = () =>
    isSinglePage(latest.current.data?.session.mode ?? 'create', latest.current.step);
  const catalogState = () => ({
    definitions: latest.current.catalog?.policies ?? [],
    error: latest.current.catalogError,
  });
  const context = () => ({
    savedAddressRefId: latest.current.data?.savedAddress?.refId,
    originalAvailableDate: latest.current.data?.session.originalAvailableDate,
  });

  function reveal(validation: ValidationResult) {
    if (!singlePage() && validation.step && validation.step !== latest.current.step)
      goToStep(validation.step);
    setErrors(validation.errors);
    setFocus(Object.keys(validation.errors));
    if (validation.message) setFlash({ tone: 'error', text: validation.message });
  }

  function validate(action: ListingSubmissionAction, skipDescription = false) {
    return validateListing(latest.current.state!, catalogState(), action, {
      ...context(),
      singlePage: singlePage(),
      skipDescription,
    });
  }

  function next() {
    const check = validateStep(latest.current.state!, catalogState(), step, context());
    if (!check.ok) return reveal(check);
    setErrors({});
    goToStep(step + 1);
  }

  async function save(action: ListingSubmissionAction, thenBuy?: QuotaPurchase) {
    const now = latest.current;
    if (savingRef.current || !now.state || !now.data) return;
    savingRef.current = true;
    Keyboard.dismiss();
    setFlash(null);
    setSaving(action);
    const result = await submitListing(
      {
        state: now.state,
        session: now.data.session,
        catalog: now.catalog,
        catalogError: now.catalogError,
        savedAddress: now.data.savedAddress,
        action,
        singlePage: singlePage(),
        roomLink: now.roomLink,
      },
      {
        onStart: (text) => {
          job.current?.abort();
          setSavingText(text);
        },
        onMediaUploaded: (kind, index, id) =>
          setState((s) => s && { ...s, basicInfo: markUploaded(s.basicInfo, kind, index, id) }),
        confirmResend: () => confirm(RESEND_CONFIRM),
      }
    );
    if (!mounted.current) return;
    if (result.status === 'saved') {
      // Stays locked: the screen is closing.
      setQuotaOpen(false);
      if (thenBuy === 'addon') {
        // Answered before leaving: a notice would collide with the purchase sheet opening next.
        const buy = await confirm({
          title: 'Thành công',
          description: result.message,
          confirmLabel: 'Mua thêm lượt',
          cancelLabel: 'Để sau',
        });
        if (!mounted.current) return;
        if (buy) onOpenMembership(true);
        else onSaved();
        return;
      }
      if (thenBuy) onOpenMembership(false);
      else onSaved();
      showDialog('Thành công', result.message, undefined, 'success');
      return;
    }
    savingRef.current = false;
    setSaving(null);
    setSavingText('');
    if (result.status === 'cancelled') return;
    // A refused room keeps the link; reading the map again lets the banner show whether it is gone.
    if (result.status !== 'invalid') void loadRooms();
    // Sending this edit itself needs a use, so nothing can be saved before buying.
    const buyOver =
      result.status === 'quota' && quotaSaveAction(now.data.session) === 'SUBMIT_FOR_REVIEW'
        ? thenBuy
        : undefined;
    if (buyOver) setBuying(buyOver);
    setQuotaOpen(result.status === 'quota' && !buyOver);
    if (result.status === 'invalid') reveal(result.validation);
    else if (result.status === 'quota') {
      setQuotaBanner(true);
      setFlash({ tone: 'error', text: result.message });
      void loadMembership();
    } else if (result.status === 'kyc')
      showDialog('Cần xác minh danh tính', result.message, [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Xác minh ngay', onPress: () => void startKyc() },
      ]);
    else if (result.status === 'error' && result.maybeSaved) {
      // No retry button here: the list shows whether the listing exists.
      showDialog(
        'Tin có thể đã được lưu',
        `${result.message}\n${MAYBE_SAVED_MESSAGE}`,
        [
          { text: 'Ở lại biểu mẫu', style: 'cancel' },
          {
            // From a room, leaving goes back to the map, which shows the listing on that room.
            text: now.roomLink ? 'Về chi nhánh kiểm tra' : 'Kiểm tra danh sách tin',
            onPress: onSaved,
          },
        ],
        'warning'
      );
    } else if (result.status === 'error' && !result.externallyRented)
      showDialog(
        'Không thể lưu tin',
        result.message,
        [
          { text: 'Đóng', style: 'cancel' },
          // Files already uploaded keep their id, so a retry only sends the rest. An edit goes
          // through submit again, which re-reads the pending edit.
          {
            text: 'Thử lại',
            onPress: () =>
              void (now.data!.session.mode === 'edit' && action === 'SUBMIT_FOR_REVIEW'
                ? submitRef.current(thenBuy)
                : saveRef.current(action, thenBuy)),
          },
        ],
        'warning'
      );
    else {
      if (result.status === 'error')
        setData((d) => d && { ...d, session: { ...d.session, status: 'RENTED_EXTERNALLY' } });
      showDialog('Không thể chỉnh sửa', result.message, undefined, 'warning');
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;

  async function submit(thenBuy?: QuotaPurchase) {
    const session = latest.current.data?.session;
    if (savingRef.current || !session) return;
    // Create and duplicate send directly; only an edit keeps a confirmation.
    if (session.mode !== 'edit') return save('SUBMIT_FOR_REVIEW', thenBuy);
    const check = validate('SUBMIT_FOR_REVIEW');
    if (!check.ok) {
      setQuotaOpen(false);
      return reveal(check);
    }
    setErrors({});
    setFlash(null);
    Keyboard.dismiss();
    // Locked while the server is asked whether a pending edit exists now.
    savingRef.current = true;
    setSaving('SUBMIT_FOR_REVIEW');
    setSavingText('Đang kiểm tra bản sửa chờ duyệt...');
    const fresh = await refreshEditSession(session, getAccessibleListing).catch(() => null);
    savingRef.current = false;
    if (!mounted.current) return;
    setSaving(null);
    setSavingText('');
    if (!fresh) {
      showDialog(
        'Chưa gửi được',
        'Không kiểm tra được trạng thái mới nhất của tin. Vui lòng kiểm tra kết nối và thử lại.',
        undefined,
        'warning'
      );
      return;
    }
    setData((d) => d && { ...d, session: fresh });
    // Rented outside meanwhile: the lock screen takes over.
    if (listingLock(fresh, latest.current.state!.basicInfo.title)) return;
    if (await confirm(editSubmitConfirm(fresh)))
      await saveRef.current('SUBMIT_FOR_REVIEW', thenBuy);
  }
  const submitRef = useRef(submit);
  submitRef.current = submit;

  /** The quota dialog's save: a draft where the API allows one, else the edit for review. */
  function saveFromQuota(thenBuy?: QuotaPurchase) {
    const session = latest.current.data?.session;
    if (!session) return;
    if (quotaSaveAction(session) === 'SAVE_DRAFT') void save('SAVE_DRAFT', thenBuy);
    else void submit(thenBuy);
  }

  async function generateDescription() {
    if (savingRef.current) return;
    const check = validate('SUBMIT_FOR_REVIEW', true);
    if (!check.ok) {
      reveal(check);
      setFlash({ tone: 'error', text: DESCRIPTION_BLOCKED_MESSAGE });
      return;
    }
    setErrors({});
    setFlash(null);
    Keyboard.dismiss();
    job.current ??= createDescriptionJob({
      read: () => {
        const now = latest.current;
        return {
          facts: buildDescriptionRequest(
            now.state!,
            now.data!.session,
            now.catalog,
            now.data!.savedAddress
          ),
          description: now.state!.basicInfo.description,
        };
      },
      fetch: fetchListingDescription,
    });
    const result = await job.current.run(
      () => confirm({ ...DESCRIPTION_REPLACE_CONFIRM, tone: 'warning', cancelLabel: 'Hủy' }),
      () => setGenerating(true)
    );
    if (result.status === 'busy' || !mounted.current) return;
    setGenerating(false);
    // A cancelled run has nothing to say; a save that started meanwhile already took the form.
    if (!('message' in result) || savingRef.current) return;
    if (result.status === 'done') {
      update((s) => ({
        ...s,
        basicInfo: { ...s.basicInfo, description: result.description },
      }));
      setErrors(({ description: _, ...rest }) => rest);
    }
    setFlash({
      tone: result.status === 'done' ? 'success' : result.status === 'stale' ? 'info' : 'error',
      text: result.message,
    });
  }

  async function requestCategory(nextCategory: PropertyCategoryKey) {
    const { state: form, data: loaded } = latest.current;
    if (!form || !loaded) return;
    const { mode } = loaded.session;
    if (!canChangeCategory(form, mode) || nextCategory === form.basicInfo.category) return;
    const label = PROPERTY_CATEGORIES.find((item) => item.key === nextCategory)!.label;
    const accepted = await confirm({
      title: 'Xác nhận đổi loại hình',
      description: `Chuyển sang: ${label}?`,
      confirmLabel: 'Đồng ý đổi',
      cancelLabel: 'Giữ nguyên',
    });
    if (!accepted) return;
    update((s) => changeCategory(s, nextCategory, mode));
    setErrors({});
  }

  function chooseBranch(branchId: string) {
    const { state: form, data: loaded } = latest.current;
    if (!form || !loaded) return;
    const apply = (s: ListingFormState) =>
      selectBranch(s, branchId, loaded.branches, loaded.session.mode);
    const { notice } = apply(form);
    update((s) => apply(s).state);
    setErrors(({ streetLine: _, ...rest }) => rest);
    const link = latest.current.roomLink;
    if (link && branchId !== link.branchId) {
      setRoomLink(null);
      const text = [ROOM_DROPPED_MESSAGE, notice?.message].filter(Boolean).join('\n');
      setFlash({ tone: 'warning', text });
      return;
    }
    setFlash(notice ? { tone: notice.type, text: notice.message } : null);
  }

  const waitForSave = () => showDialog('Đang lưu tin', 'Vui lòng đợi lưu xong rồi mở lại.');

  /** Runs `then` right away, or after the user agrees to lose the unsaved changes. */
  function leave(then: () => void) {
    if (savingRef.current) return;
    if (!dirty.current) return then();
    showDialog('Rời biểu mẫu?', 'Thông tin chưa lưu sẽ mất khi thoát.', [
      { text: 'Tiếp tục chỉnh sửa', style: 'cancel' },
      {
        text: 'Rời biểu mẫu',
        style: 'destructive',
        onPress: unlessBusy(() => mounted.current && savingRef.current, then, waitForSave),
      },
    ]);
  }

  // Navigation from outside the editor (push tap, profile gate) asks the same question.
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  const waitRef = useRef(waitForSave);
  waitRef.current = waitForSave;
  useEffect(
    () =>
      setLeaveGuard((go) => {
        if (savingRef.current) waitRef.current();
        else leaveRef.current(go);
      }),
    []
  );

  return {
    data,
    state,
    loadError,
    catalog,
    catalogError,
    retryCatalog: () => setCatalogRetry((value) => value + 1),
    errors,
    step,
    flash,
    closeFlash: () => setFlash(null),
    saving,
    savingText,
    generating,
    membership,
    membershipLoading,
    loadMembership,
    role,
    kycNeeded,
    quotaBanner,
    quotaOpen,
    openQuota: () => setQuotaOpen(true),
    closeQuota: () => setQuotaOpen(false),
    scrollRef,
    contentRef,
    anchors,
    update,
    goToStep,
    next,
    save,
    submit,
    saveFromQuota,
    generateDescription,
    requestCategory,
    chooseBranch,
    roomLink,
    /** False while the form has another branch than the room's: submitting is refused. */
    roomBranchApplied: !roomLink || state?.basicInfo.branchId === roomLink.branchId,
    rooms,
    pickRoom: (id: string) => setRoomLink((link) => link && { ...link, roomId: id }),
    removeRoomLink: () => setRoomLink(null),
    retryRooms: () => {
      setRooms(null);
      void loadRooms();
    },
    exit: () => leave(onBack),
    /** Any other way out, behind the same question. */
    leaveTo: leave,
    buying,
    closeBuying: () => {
      setBuying(null);
      // Uses may have been bought: the next refusal sets the banner again.
      setQuotaBanner(false);
      setFlash(null);
      void loadMembership();
    },
    openMembership: (addon: boolean) => {
      if (savingRef.current) return;
      const route = membershipRoute(dirty.current, quotaBanner || isOutOfQuota(membership));
      if (route === 'leave') onOpenMembership(addon);
      else if (route === 'save-first') setQuotaOpen(true);
      else setBuying(addon ? 'addon' : 'plan');
    },
  };
}
