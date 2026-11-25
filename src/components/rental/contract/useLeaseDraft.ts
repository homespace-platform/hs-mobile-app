// Draft editing, save + render and send of ContractDetailView.tsx (DV:85-104, :249-408). The state
// lives here, above the tabs, so unsaved input survives switching tabs (web keepMounted).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '@/components/rental/onboarding/common';
import {
  draftMeterRules,
  draftRevisionPayload,
  draftState,
  hasReadyCurrentDocument,
  isDraftDirty,
  isReviewLocked,
  isSignatureLocked,
  PHONE_ERROR,
  validateDraft,
} from '@/lib/rental/ContractDetailView';
import { draftContentPatch, draftEditorValues } from '@/lib/rental/ContractDraftEditor';
import type { DraftPolicyFields } from '@/lib/rental/ContractPoliciesSection';
import { contractService } from '@/services/rental/contract.service';
import type { AmendmentTerms, TermRow } from '@/types/rental/contract-amendment.type';
import type {
  ContractCompletenessResponse,
  ContractDocumentResponse,
  ContractListingSyncPreview,
  ContractResponse,
  ContractRevisionResponse,
  SignatureStateResponse,
} from '@/types/rental/contract.type';

import { draftFieldErrors, runDraftRender, type RenderEvent } from './contractDetailLogic';

export type MeterErrors = { electricity?: string; water?: string };

export function useLeaseDraft(input: {
  contractId: string;
  contract: ContractResponse | null;
  isLandlord: boolean;
  signatureState: SignatureStateResponse | null;
  documents: ContractDocumentResponse[];
  onboardingStage?: string | null;
  setDocuments: (
    next: (previous: ContractDocumentResponse[]) => ContractDocumentResponse[]
  ) => void;
  setCompleteness: (next: ContractCompletenessResponse) => void;
  /** The save made this the contract's current revision, whatever the render does next. */
  onSaved: (revision: ContractRevisionResponse) => void;
  /** Brings the viewer to a refused field of the content tab. */
  onInvalid: (anchorId: string) => void;
  /** A preview is ready: the web scrolls to the top. */
  onRendered: () => void;
}) {
  const { contractId, contract, isLandlord, signatureState, documents } = input;
  const toast = useToast();

  const [revision, setRevision] = useState<ContractRevisionResponse | null>(null);
  const [currentPreview, setCurrentPreview] = useState<ContractDocumentResponse | null>(null);
  const [rendering, setRendering] = useState(false);
  const [reconcilingPreview, setReconciling] = useState(false);
  const [electricityInitial, setElectricity] = useState('');
  const [waterInitial, setWater] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftPolicy, setDraftPolicy] = useState<Partial<DraftPolicyFields>>({});
  const [feeError, setFeeError] = useState<string>();
  const [retryPreview, setRetryPreview] = useState(false);
  const [draftConflict, setDraftConflict] = useState(false);
  const [meterErrors, setMeterErrors] = useState<MeterErrors>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftEdits, setDraftEdits] = useState<Partial<AmendmentTerms>>({});
  const [listingSyncPreview, setListingSyncPreview] = useState<ContractListingSyncPreview | null>(
    null
  );
  const [syncingListing, setSyncingListing] = useState(false);
  const previewRequest = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      previewRequest.current?.abort();
      previewRequest.current = null;
    },
    [contractId]
  );

  const takeMeters = (rev: ContractRevisionResponse) => {
    setElectricity(String(rev.meters?.electricityInitial ?? ''));
    setWater(String(rev.meters?.waterInitial ?? ''));
  };

  /** Everything the web's load() resets before reading again (:127-139). */
  const reset = useCallback(() => {
    setRendering(false);
    setReconciling(false);
    setCurrentPreview(null);
    setDraftPolicy({});
    setDraftConflict(false);
    setRetryPreview(false);
    setSavingDraft(false);
    setMeterErrors({});
    setFieldErrors({});
    setFeeError(undefined);
    setDraftEdits({});
    setListingSyncPreview(null);
    setSyncingListing(false);
  }, []);
  const loaded = useCallback(
    (rev: ContractRevisionResponse | null, preview: ContractDocumentResponse | null) => {
      setRevision(rev);
      if (rev) takeMeters(rev);
      setCurrentPreview(preview);
    },
    []
  );

  const draftCharges = (listingSyncPreview?.terms.charges ?? revision?.charges ?? []) as TermRow[];
  const { electricityRequired, waterRequired, isWaterPerPerson } = draftMeterRules(draftCharges);

  const reviewDraft = Boolean(
    isLandlord && contract?.status === 'DRAFT' && !contract.parentContractId
  );
  const signatureLocked = isSignatureLocked(contract, signatureState);
  const reviewLocked = isReviewLocked(draftConflict, signatureLocked, input.onboardingStage);

  const baseTerms = useMemo(() => draftEditorValues(revision), [revision]);
  const draftContent = useMemo(
    () => draftContentPatch(baseTerms, draftEdits),
    [baseTerms, draftEdits]
  );
  const form = {
    revision,
    electricityInitial,
    waterInitial,
    draftPolicy,
    draftContent,
    isWaterPerPerson,
  };
  const state = draftState(form);
  const draftDirty = isDraftDirty(reviewDraft, state, draftContent, listingSyncPreview);
  const draftBusy = savingDraft || rendering || reconcilingPreview || syncingListing;
  const readyDocument = hasReadyCurrentDocument({
    documents,
    revision,
    contract,
    currentPreview,
    signatureMode: signatureState?.signatureMode,
  });
  const readyToSign = readyDocument && !draftDirty && !draftBusy && !draftConflict;
  const documentsAvailable = readyDocument && !draftDirty && !draftConflict;

  function apply(event: RenderEvent, say: (kind: 'success' | 'info' | 'error', m: string) => void) {
    switch (event.type) {
      case 'saving':
        setSavingDraft(true);
        break;
      case 'saved':
        setRevision(event.revision);
        input.onSaved(event.revision);
        setCurrentPreview(null);
        setDraftPolicy({});
        setDraftEdits({});
        setListingSyncPreview(null);
        takeMeters(event.revision);
        setSavingDraft(false);
        break;
      case 'rendering':
        setRendering(true);
        setReconciling(false);
        break;
      case 'reconciling':
        setReconciling(true);
        break;
      case 'preview': {
        const { doc } = event;
        setRetryPreview(!doc);
        if (doc) {
          input.setDocuments((previous) => [doc, ...previous.filter((d) => d.id !== doc.id)]);
          setCurrentPreview(doc);
          say('success', event.message);
          input.onRendered();
        } else say('info', event.message);
        break;
      }
      case 'failed':
        if (event.conflict) {
          setDraftConflict(true);
          setCurrentPreview(null);
        }
        setRetryPreview(event.retry);
        say('error', event.message);
        break;
      case 'refreshed':
        if (event.completeness) input.setCompleteness(event.completeness);
        if (event.documents) input.setDocuments(event.documents);
        break;
    }
  }

  /** `notice` is the listing sync message the web showed just before (see ListingSyncControl). */
  async function render(sourceOverride?: ContractListingSyncPreview, notice?: string) {
    const say = (kind: 'success' | 'info' | 'error', message: string) =>
      toast[kind](notice ? `${notice}\n\n${message}` : message);
    if (!contractId || !revision || previewRequest.current || (reviewDraft && reviewLocked)) {
      if (notice) toast.info(notice);
      return;
    }
    const source = sourceOverride ?? listingSyncPreview;
    const needsSave = draftDirty || Boolean(reviewDraft && source);
    if (sourceOverride && sourceOverride.baseRevisionId !== revision.id) {
      toast.error('Phiên bản hợp đồng đã thay đổi. Tải lại trang trước khi cập nhật.');
      return;
    }
    if (reviewDraft) {
      const checked = validateDraft({
        electricityInitial,
        waterInitial,
        electricityRequired,
        waterRequired,
        isWaterPerPerson,
        draftFields: state.draftFields,
        draftContent,
      });
      setMeterErrors(checked.errors);
      setFeeError(checked.feeError);
      const invalidFields = draftFieldErrors(baseTerms, { ...baseTerms, ...draftEdits });
      setFieldErrors(checked.section ? {} : invalidFields);
      if (checked.section) {
        if (checked.invalidPhone) say('error', PHONE_ERROR);
        else if (notice) toast.info(notice);
        input.onInvalid(checked.section);
        return;
      }
      if (Object.keys(invalidFields).length) {
        if (notice) toast.info(notice);
        input.onInvalid('contract-parties');
        return;
      }
    }

    const request = new AbortController();
    previewRequest.current = request;
    try {
      await runDraftRender(
        contractService,
        {
          contractId,
          revision,
          payload: needsSave ? draftRevisionPayload({ ...form, revision }, source) : null,
          reviewDraft,
        },
        request.signal,
        () => previewRequest.current === request,
        (event) => apply(event, say)
      );
    } finally {
      if (previewRequest.current === request) {
        previewRequest.current = null;
        setSavingDraft(false);
        setRendering(false);
        setReconciling(false);
      }
    }
  }

  return {
    revision,
    loaded,
    reset,
    render,
    /** True while a render is running (web previewRequest.current). */
    isRendering: () => Boolean(previewRequest.current),
    rendering,
    reconcilingPreview,
    savingDraft,
    syncingListing,
    setSyncingListing,
    retryPreview,
    currentPreview,
    electricityInitial,
    waterInitial,
    setElectricityInitial(value: string) {
      setElectricity(value);
      setMeterErrors((previous) => ({ ...previous, electricity: undefined }));
    },
    setWaterInitial(value: string) {
      setWater(value);
      setMeterErrors((previous) => ({ ...previous, water: undefined }));
    },
    meterErrors,
    fieldErrors,
    feeError,
    electricityRequired,
    waterRequired,
    isWaterPerPerson,
    reviewDraft,
    signatureLocked,
    reviewLocked,
    draftConflict,
    draftFields: state.draftFields,
    changePolicy(changes: Partial<DraftPolicyFields>) {
      setDraftPolicy((previous) => ({ ...previous, ...changes }));
      setFeeError(undefined);
    },
    baseTerms,
    draftEdits,
    patchTerms(group: keyof AmendmentTerms, value: TermRow | TermRow[] | string) {
      setDraftEdits((previous) => ({ ...previous, [group]: value }));
      setFieldErrors({});
    },
    listingSyncPreview,
    setListingSyncPreview,
    draftDirty,
    draftBusy,
    readyDocument,
    readyToSign,
    documentsAvailable,
  };
}
