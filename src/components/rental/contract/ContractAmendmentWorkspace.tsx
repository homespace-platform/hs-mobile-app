// Web: components/contract/detail/ContractAmendmentWorkspace.tsx (AW line numbers below). The pure
// rules are in @/lib/rental/ContractAmendmentWorkspace.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { randomUUID } from 'expo-crypto';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import { useToast } from '@/components/rental/onboarding/common';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import {
  amendmentChangedGroupCount,
  amendmentChanges,
  amendmentFinancial,
  amendmentHasChanges,
  amendmentPayload,
  amendmentStart,
  empty,
  scheduledSource,
} from '@/lib/rental/ContractAmendmentWorkspace';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { useAgreementChangeSync, useVisiblePoll } from '@/lib/rental-sync/hooks';
import { contractAmendmentService as api } from '@/services/rental/contract-amendment.service';
import { contractService } from '@/services/rental/contract.service';
import type { LocalFile } from '@/services/storageApi';
import type {
  AmendmentPayload,
  AmendmentProposal,
  AmendmentTerms,
  ContractAmendments,
  TermRow,
} from '@/types/rental/contract-amendment.type';
import type { ContractListingSyncPreview } from '@/types/rental/contract.type';

import { invalidAmendmentField } from './amendmentLogic';

/**
 * The screen provides this to block leaving while any workspace (the page's, or the one the panel
 * makes on a child contract) is composing: the web's beforeunload (AW:77-82).
 */
export const AmendmentEditingGuard = createContext<((editing: boolean) => void) | null>(null);

function useWorkspaceState(
  contractId: string,
  actorId: string,
  perspective: DashboardRole,
  enabled: boolean
) {
  const toast = useToast();
  const [data, setDataState] = useState<ContractAmendments | null>(null);
  const [error, setError] = useState('');
  const [savedDraft, setSavedDraftState] = useState<AmendmentPayload | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<AmendmentTerms>(empty);
  const [listingSourceVersion, setListingSourceVersion] = useState<string>();
  const [listingSync, setListingSync] = useState<ContractListingSyncPreview | null>(null);
  const [editingFinancial, setEditingFinancial] = useState(false);
  const [reason, setReason] = useState('');
  const [effectiveOn, setEffectiveOn] = useState('');
  const [previousId, setPreviousId] = useState<string>();
  const [tenantRequestId, setTenantRequestId] = useState<string>();
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [files, setFiles] = useState<LocalFile[]>([]);
  useDiscardDroppedFiles(files);
  const mutex = useRef(false);
  const editingRef = useRef(false);
  const draftBase = useRef('');
  const requestId = useRef('');
  // Mobile only: bumped on every new session and every drop or re-pick of the listing source.
  const sourceTurn = useRef(0);
  const [initialValues, setInitialValues] = useState('');
  const editBaseline = useMemo<AmendmentTerms | null>(
    () => (initialValues ? JSON.parse(initialValues) : null),
    [initialValues]
  );
  // A read that started before a newer read or a saved answer must not overwrite it.
  const reads = useRef(0);
  const applied = useRef(0);
  const draftWritten = useRef(false);
  const setData = useCallback((next: ContractAmendments) => {
    applied.current = ++reads.current;
    setDataState(next);
  }, []);
  const setSavedDraft = useCallback((next: AmendmentPayload | null) => {
    draftWritten.current = true;
    setSavedDraftState(next);
  }, []);
  const load = useCallback(async () => {
    if (!enabled) return;
    const mine = ++reads.current;
    try {
      const response = await api.get(contractId);
      if (mine < applied.current) return;
      applied.current = mine;
      setDataState(response);
      setError('');
    } catch (e) {
      if (mine < applied.current) return;
      setError(getApiErrorMessage(e, 'Không tải được điều khoản đang áp dụng.'));
    }
  }, [contractId, enabled]);
  useEffect(() => {
    void load();
    if (enabled && perspective === 'landlord') {
      void api
        .draft(contractId)
        .then((draft) => {
          if (!draftWritten.current) setSavedDraftState(draft);
        })
        .catch(() => {
          /* Explicit save failures are reported; absence never changes terms. */
        });
    }
  }, [load, contractId, perspective, enabled]);
  // Neither the poll nor the signal re-reads while composing or saving (AW:71,75-76).
  const idleLoad = () => (editingRef.current || mutex.current ? undefined : load());
  useVisiblePoll(idleLoad, 30_000, enabled);
  useAgreementChangeSync(
    (id) =>
      !!id && (id === contractId || !!data?.proposals.some((p) => p.agreementContractId === id)),
    idleLoad,
    enabled
  );
  const guard = useContext(AmendmentEditingGuard);
  useEffect(() => {
    if (!editing || !guard) return;
    guard(true);
    return () => guard(false);
  }, [editing, guard]);
  /** One action at a time; every failure is announced (AW:83-88). */
  const run = async (fn: () => Promise<void>) => {
    if (mutex.current) return;
    mutex.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không thực hiện được thao tác.'));
    } finally {
      mutex.current = false;
      setBusy(false);
    }
  };
  // AW:89-120
  const start = (
    previous?: AmendmentProposal,
    draft?: AmendmentPayload | null,
    source?: AmendmentProposal
  ) => {
    if (!data || perspective !== 'landlord') return;
    const next = amendmentStart(data, previous, draft, source);
    if (next.error !== undefined) {
      toast.error(next.error);
      return;
    }
    const sourceVersion = next.listingSourceVersion;
    setValues(next.values);
    setListingSourceVersion(sourceVersion);
    setListingSync(null);
    setEditingFinancial(next.editingFinancial);
    setInitialValues(next.initialValues);
    setReason(next.reason);
    setEffectiveOn(next.effectiveOn);
    setPreviousId(next.previousId);
    setTenantRequestId(next.tenantRequestId);
    setEvidenceIds(next.evidenceIds);
    setFiles([]);
    draftBase.current = data.currentTermsRevisionId;
    requestId.current = randomUUID();
    const turn = ++sourceTurn.current;
    if (sourceVersion) {
      const stale = () => sourceTurn.current !== turn || !editingRef.current;
      void contractService
        .previewListingSync(contractId)
        .then((preview) => {
          if (stale()) return;
          if (
            preview.sourceVersion === sourceVersion &&
            preview.baseRevisionId === draftBase.current
          )
            setListingSync(preview);
          else
            toast.error('Bản bài đăng trong đề xuất đã cũ. Hãy cập nhật lại dữ liệu từ bài đăng.');
        })
        .catch(() => {
          if (!stale())
            toast.error('Không tải được bản bài đăng trong đề xuất. Hãy đối chiếu lại dữ liệu.');
        });
    }
    setEditing(true);
    editingRef.current = true;
  };
  const changes = useMemo(
    () => amendmentChanges(data, editing, values, previousId, listingSourceVersion),
    [data, editing, values, previousId, listingSourceVersion]
  );
  const replacement = scheduledSource(data?.proposals ?? [], previousId);
  const hasChanges = amendmentHasChanges(
    changes,
    replacement,
    values,
    initialValues,
    listingSourceVersion
  );
  const changedGroupCount = useMemo(
    () => amendmentChangedGroupCount(changes, replacement, values, initialValues),
    [replacement, initialValues, changes, values]
  );
  const financial = amendmentFinancial(changes, listingSync);
  const payload = (validate = true): AmendmentPayload =>
    amendmentPayload(
      {
        data,
        listingSourceVersion,
        listingSync,
        changes,
        hasChanges,
        reason,
        effectiveOn,
        replacement,
        requestId: requestId.current,
        baseRevisionId: draftBase.current,
        previousId,
        tenantRequestId,
        evidenceIds,
        hasInvalidInput: invalidAmendmentField(values) !== null,
      },
      validate
    );
  const stop = () => {
    // The draft is over (sent or cancelled); `start` begins with no files anyway.
    setFiles([]);
    setEditing(false);
    editingRef.current = false;
  };
  const patch = useCallback(
    (group: keyof AmendmentTerms, value: TermRow | TermRow[] | string) =>
      setValues((v) => ({ ...v, [group]: value })),
    []
  );
  const selectListingSync = (preview: ContractListingSyncPreview | null) => {
    sourceTurn.current++;
    setListingSync(preview);
    setListingSourceVersion(preview?.sourceVersion);
  };
  return {
    contractId,
    actorId,
    perspective,
    data,
    setData,
    error,
    savedDraft,
    setSavedDraft,
    editing,
    busy,
    run,
    load,
    start,
    stop,
    values,
    patch,
    changes,
    financial,
    replacement,
    hasChanges,
    changedGroupCount,
    editBaseline,
    reason,
    setReason,
    effectiveOn,
    setEffectiveOn,
    payload,
    files,
    setFiles,
    evidenceIds,
    setEvidenceIds,
    listingSync,
    listingSourceVersion,
    selectListingSync,
    editingFinancial,
    setEditingFinancial,
  };
}

export type AmendmentWorkspace = ReturnType<typeof useWorkspaceState>;

const Context = createContext<AmendmentWorkspace | null>(null);
export const useAmendmentWorkspace = () => useContext(Context);

export function ContractTermsNotice() {
  const workspace = useAmendmentWorkspace();
  return (
    <PolicyNotice
      tone="neutral"
      title="Điều khoản đang áp dụng"
      text={
        workspace?.error
          ? 'Chưa tải được điều khoản hiện tại. Các mục bên dưới tạm hiển thị bản hợp đồng gốc; tải lại mục Phụ lục trước khi đối chiếu.'
          : !workspace?.data
            ? 'Đang kiểm tra phụ lục để hiển thị điều khoản hiện tại. Bản hợp đồng gốc đã ký được giữ nguyên trong hồ sơ.'
            : 'Các mục bên dưới thể hiện điều khoản đang áp dụng, bao gồm phụ lục đã đủ chữ ký và đến ngày hiệu lực. Bản hợp đồng gốc đã ký được giữ nguyên tại Tài liệu hợp đồng.'
      }
    />
  );
}

export default function ContractAmendmentWorkspace({
  contractId,
  actorId,
  perspective,
  enabled = true,
  children,
}: {
  contractId: string;
  actorId: string;
  perspective: DashboardRole;
  enabled?: boolean;
  children: ReactNode;
}) {
  const state = useWorkspaceState(contractId, actorId, perspective, enabled);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
