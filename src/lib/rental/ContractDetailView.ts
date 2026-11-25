// Port of the pure rules inside hs-web-app components/contract/ContractDetailView.tsx (line numbers refer to it).
import { validateInitialMeterReading } from '@/lib/rental/contract-initial-meters';
import { draftContentPatch } from '@/lib/rental/ContractDraftEditor';
import type { DraftPolicyFields } from '@/lib/rental/ContractPoliciesSection';
import { numberVi } from '@/lib/rental/format';
import { VIETNAMESE_PHONE_REGEX } from '@/lib/profile-form';
import type {
  ContractDocumentResponse,
  ContractListingSyncPreview,
  ContractResponse,
  ContractRevisionResponse,
  SignatureStateResponse,
  UpdateContractRevisionRequest,
} from '@/types/rental/contract.type';

// :66-69
export const POST_ACTIVE = ['ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED'];
export const money = (n: number) => `${numberVi(n)} đ`;
export const isoDate = (s: string) => s.split('T')[0].split('-').reverse().join('/');

// :116-117 — pre-tenancy: the deposit agreement, or a lease that is not yet in effect.
export const isPreActive = (
  contract:
    Pick<ContractResponse, 'status' | 'agreementKind' | 'parentContractId'> | null | undefined
) =>
  Boolean(
    contract &&
    contract.agreementKind !== 'WORKFLOW' &&
    !contract.parentContractId &&
    (contract.agreementKind === 'DEPOSIT' || !POST_ACTIVE.includes(contract.status))
  );

// :220-231
export function latestDoc(
  documents: ContractDocumentResponse[],
  contractStatus: string | undefined,
  currentPreview: Pick<ContractDocumentResponse, 'id'> | null,
  revisionId: string | undefined
): ContractDocumentResponse | null {
  if (contractStatus === 'DRAFT')
    return (
      documents.find(
        (doc) =>
          doc.id === currentPreview?.id && doc.revisionId === revisionId && doc.status === 'READY'
      ) ?? null
    );
  const ready = documents.filter(
    (d) =>
      d.status === 'READY' &&
      (d.viewUrl ||
        d.downloadUrl ||
        (d.documentType === 'PDF' && d.purpose === 'SIGNED_FINAL' && d.storageObjectId))
  );
  const preferred = ['SIGNED_FINAL', 'SIGNED_LANDLORD', 'OFFICIAL', 'PREVIEW'];
  return (
    ready.sort((a, b) => preferred.indexOf(a.purpose) - preferred.indexOf(b.purpose))[0] ??
    documents[0] ??
    null
  );
}

// :233-248
export function hasReadyCurrentDocument(input: {
  documents: ContractDocumentResponse[];
  revision: Pick<ContractRevisionResponse, 'id'> | null;
  contract: Pick<ContractResponse, 'status' | 'parentContractId'> | null;
  currentPreview: Pick<ContractDocumentResponse, 'id' | 'revisionId'> | null;
  signatureMode?: SignatureStateResponse['signatureMode'];
}): boolean {
  const { documents, revision, contract, currentPreview, signatureMode } = input;
  return Boolean(
    revision &&
    (contract?.status !== 'DRAFT' || currentPreview?.revisionId === revision.id) &&
    documents.some(
      (document) =>
        document.revisionId === revision.id &&
        (contract?.status !== 'DRAFT' || document.id === currentPreview?.id) &&
        ((signatureMode !== 'SMARTCA' &&
          (contract?.status !== 'DRAFT' || contract.parentContractId)) ||
          document.documentType === 'PDF') &&
        document.status === 'READY' &&
        Boolean(document.storageObjectId)
    )
  );
}

// :250-265 — `charges` is `listingSyncPreview?.terms.charges ?? revision?.charges ?? []`.
export function draftMeterRules(charges: Record<string, unknown>[]) {
  const electricityRequired = charges.some(
    (charge) => charge.chargeType === 'ELECTRICITY' && charge.billingMethod === 'PER_KWH'
  );
  const waterRequired = charges.some(
    (charge) =>
      charge.chargeType === 'WATER' &&
      ['PER_M3', 'STATE_WATER_RATE'].includes(String(charge.billingMethod))
  );
  const isWaterPerPerson =
    !waterRequired &&
    charges.some(
      (charge) => charge.chargeType === 'WATER' && charge.billingMethod === 'PER_PERSON_MONTH'
    );
  return { electricityRequired, waterRequired, isWaterPerPerson };
}

// :273-275
export const isSignatureLocked = (
  contract: Pick<ContractResponse, 'landlordConfirmedAt'> | null,
  signatureState: Pick<SignatureStateResponse, 'allRequests'> | null
) =>
  Boolean(
    contract?.landlordConfirmedAt ||
    signatureState?.allRequests?.some(({ status }) =>
      ['CREATED', 'PENDING_USER_CONFIRMATION', 'PROVIDER_SIGNED', 'EMBEDDING', 'SIGNED'].includes(
        status
      )
    )
  );
export const isReviewLocked = (
  draftConflict: boolean,
  signatureLocked: boolean,
  onboardingStage?: string | null
) => draftConflict || signatureLocked || onboardingStage === 'CANCELLATION_REFUND_PENDING';

export interface DraftForm {
  revision: ContractRevisionResponse | null;
  electricityInitial: string;
  waterInitial: string;
  /** Only the fields the user touched. */
  draftPolicy: Partial<DraftPolicyFields>;
  /** `draftContentPatch(draftEditorValues(revision), draftEdits)`. */
  draftContent: ReturnType<typeof draftContentPatch>;
  isWaterPerPerson: boolean;
}

// :267-270 and :276-285
export function draftState(form: DraftForm) {
  const { revision, draftPolicy, isWaterPerPerson } = form;
  const metersDirty = Boolean(
    revision &&
    (form.electricityInitial.trim() !== String(revision.meters?.electricityInitial ?? '').trim() ||
      (!isWaterPerPerson &&
        form.waterInitial.trim() !== String(revision.meters?.waterInitial ?? '').trim()))
  );
  const savedFeeMode =
    (revision?.policies?.latePaymentFeeMode as DraftPolicyFields['feeMode']) ?? 'NONE';
  const savedFeeAmount = String(revision?.policies?.latePaymentFeeAmount ?? '');
  const draftFields: DraftPolicyFields = {
    feeMode: draftPolicy.feeMode ?? savedFeeMode,
    feeAmount: draftPolicy.feeAmount ?? savedFeeAmount,
    additionalTerms: draftPolicy.additionalTerms ?? revision?.additionalTerms ?? undefined,
  };
  const feeDirty =
    draftFields.feeMode !== savedFeeMode ||
    (draftFields.feeMode !== 'NONE' && Number(draftFields.feeAmount) !== Number(savedFeeAmount));
  const termsDirty =
    (draftFields.additionalTerms ?? '').trim() !== (revision?.additionalTerms ?? '').trim();
  return { metersDirty, draftFields, feeDirty, termsDirty };
}

// :288
export const isDraftDirty = (
  reviewDraft: boolean,
  state: ReturnType<typeof draftState>,
  draftContent: DraftForm['draftContent'],
  listingSyncPreview: ContractListingSyncPreview | null
) =>
  reviewDraft &&
  Boolean(
    state.metersDirty || state.feeDirty || state.termsDirty || draftContent || listingSyncPreview
  );

export const FEE_ERROR = 'Nhập mức phạt là số tiền nguyên dương, tối đa 1 tỷ đồng.';
export const PHONE_ERROR = 'Nhập số điện thoại di động Việt Nam hợp lệ.';

// :305-324 — checks before a reviewed draft is saved. `section` is where to scroll, null when valid.
// The web's `form.reportValidity()` (:325) is the mobile form's own input validation.
export function validateDraft(input: {
  electricityInitial: string;
  waterInitial: string;
  electricityRequired: boolean;
  waterRequired: boolean;
  isWaterPerPerson: boolean;
  draftFields: DraftPolicyFields;
  draftContent: DraftForm['draftContent'];
}) {
  const errors = {
    electricity: validateInitialMeterReading(
      input.electricityInitial,
      input.electricityRequired,
      'chỉ số điện ban đầu'
    ),
    water: input.isWaterPerPerson
      ? undefined
      : validateInitialMeterReading(input.waterInitial, input.waterRequired, 'chỉ số nước ban đầu'),
  };
  const amount = Number(input.draftFields.feeAmount);
  const invalidFee =
    input.draftFields.feeMode !== 'NONE' &&
    (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000);
  const invalidPhone = [input.draftContent?.landlord, input.draftContent?.tenant].some(
    (party) =>
      party?.phone !== undefined && !VIETNAMESE_PHONE_REGEX.test(String(party.phone).trim())
  );
  const section =
    errors.electricity || errors.water || invalidFee || invalidPhone
      ? errors.electricity || errors.water
        ? ('contract-handover' as const)
        : invalidPhone
          ? ('contract-parties' as const)
          : ('contract-policies' as const)
      : null;
  return { errors, feeError: invalidFee ? FEE_ERROR : undefined, invalidPhone, section };
}

// :336-347 — PATCH body of the draft revision. `source` is the listing sync preview being applied.
export function draftRevisionPayload(
  form: DraftForm & { revision: ContractRevisionResponse },
  source?: Pick<ContractListingSyncPreview, 'sourceVersion'> | null
): UpdateContractRevisionRequest {
  const { metersDirty, termsDirty, feeDirty, draftFields } = draftState(form);
  const payload: UpdateContractRevisionRequest = {
    baseRevisionId: form.revision.id,
    revisionNote: 'Hoàn thiện bản nháp hợp đồng.',
  };
  if (metersDirty)
    payload.meters = {
      electricityInitial: form.electricityInitial.trim(),
      ...(form.isWaterPerPerson ? {} : { waterInitial: form.waterInitial.trim() }),
    };
  if (termsDirty) payload.additionalTerms = draftFields.additionalTerms?.trim();
  if (form.draftContent) payload.draftContent = form.draftContent;
  if (source) payload.listingSourceVersion = source.sourceVersion;
  if (feeDirty)
    payload.policies = {
      latePaymentFeeMode: draftFields.feeMode,
      latePaymentFeeAmount: draftFields.feeMode === 'NONE' ? 0 : Number(draftFields.feeAmount),
    };
  return payload;
}

/** :378-382 — the server rejects a save on a stale revision with code 6072. */
export const isDraftConflictError = (error: unknown) =>
  String((error as { response?: { data?: { code?: number | string } } })?.response?.data?.code) ===
  '6072';
