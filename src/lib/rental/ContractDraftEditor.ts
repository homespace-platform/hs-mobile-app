// Port of hs-web-app components/contract/detail/ContractDraftEditor.tsx (verbatim; only import paths changed).
import { createContext, useContext } from 'react';
import type { AmendmentTerms, TermRow } from '@/types/rental/contract-amendment.type';
import type {
  ContractRevisionResponse,
  UpdateContractRevisionRequest,
} from '@/types/rental/contract.type';

export const ContractDraftEditor = createContext<{
  values: AmendmentTerms;
  base: AmendmentTerms;
  busy: boolean;
  patch: (group: keyof AmendmentTerms, value: TermRow | TermRow[] | string) => void;
} | null>(null);

export const useContractDraftEditor = () => useContext(ContractDraftEditor);

export function draftEditorValues(revision: ContractRevisionResponse | null): AmendmentTerms {
  return {
    landlord: revision?.landlord ?? {},
    tenant: revision?.tenant ?? {},
    property: revision?.property ?? {},
    financial: revision?.financial ?? {},
    lease: revision?.lease ?? {},
    charges: revision?.charges ?? [],
    amenities: revision?.amenities ?? [],
    equipments: revision?.equipments ?? [],
    policies: revision?.policies ?? {},
    specialTerms: revision?.additionalTerms ?? '',
  };
}

export function draftContentPatch(base: AmendmentTerms, edits: Partial<AmendmentTerms>) {
  const changes: NonNullable<UpdateContractRevisionRequest['draftContent']> = {};
  for (const group of ['landlord', 'tenant'] as const) {
    const fields = Object.fromEntries(
      Object.entries(edits[group] ?? {}).filter(
        ([key, value]) => JSON.stringify(value) !== JSON.stringify(base[group]?.[key])
      )
    );
    if (Object.keys(fields).length) changes[group] = fields;
  }
  return Object.keys(changes).length ? changes : undefined;
}
