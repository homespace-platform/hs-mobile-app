// Port of hs-web-app components/rental-request/useRequestContracts.ts (B-233, A-021…A-024).
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isAppVisible } from '@/lib/rental-sync/hooks';
import { contractService } from '@/services/rental/contract.service';
import type { ContractResponse } from '@/types/rental/contract.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { contractLookupKeys, mergeContractLookup, type ContractMaps } from './logic';

export function useRequestContracts(requests: RentalRequestResponse[]) {
  const [maps, setMaps] = useState<ContractMaps>({ agreements: {}, contracts: {} });

  const lookup = useCallback(async (ids: string[], isCancelled: () => boolean) => {
    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await contractService.getByRentalRequest(id, true)] as const;
        } catch {
          return [id, undefined] as const;
        }
      })
    );
    if (!isCancelled()) setMaps((previous) => mergeContractLookup(previous, entries));
  }, []);

  // Keyed by the id set so a silent refresh that changes nothing does not refetch every contract.
  const { all, active } = useMemo(() => contractLookupKeys(requests), [requests]);

  useEffect(() => {
    if (!all) return;
    let cancelled = false;
    void lookup(all.split(','), () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [all, lookup]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const interval = setInterval(() => {
      if (isAppVisible()) void lookup(active.split(','), () => cancelled);
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active, lookup]);

  const rememberContract = useCallback((requestId: string, contract: ContractResponse) => {
    setMaps((previous) => ({
      ...previous,
      contracts: { ...previous.contracts, [requestId]: contract },
    }));
  }, []);
  return {
    contractsByRequest: maps.contracts,
    agreementsByRequest: maps.agreements,
    rememberContract,
  };
}
