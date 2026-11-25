// State of hs-web-app components/rental-request/useRentalRequestList.ts.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useDialog } from '@/components/AppDialog';
import {
  createListTickets,
  LIST_LOAD_ERROR,
  loadPage,
  type RequestFilter,
} from '@/lib/rental/useRentalRequestList';
import rentalRequestService from '@/services/rental/rental-request.service';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { keepIfSame, runListLoad, type Mode } from './logic';

export function useRentalRequestList(mode: Mode, userId: string | null) {
  const showDialog = useDialog();
  const tickets = useRef(createListTickets());
  const [statusFilter, setStatusFilter] = useState<RequestFilter>('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RentalRequestResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadRequests = useCallback(
    async (silent: boolean) => {
      if (!userId) return;
      const ticket = tickets.current.start(silent);
      if (!silent) setLoading(true);
      await runListLoad(
        ticket,
        silent,
        () => loadPage(rentalRequestService, mode, statusFilter, page),
        {
          rows: (next) => {
            setRequests((previous) => keepIfSame(previous, next.rows));
            setTotalElements(next.totalElements);
            setTotalPages(next.totalPages);
          },
          failed: () => showDialog('Thông báo', LIST_LOAD_ERROR),
          settled: () => setLoading(false),
        }
      );
    },
    [userId, mode, statusFilter, page, showDialog]
  );
  const fetchRequests = useCallback(() => loadRequests(false), [loadRequests]);
  // Silent: no skeleton, no message, and an unchanged page keeps the same array.
  const refreshRequests = useCallback(() => loadRequests(true), [loadRequests]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const changeFilter = useCallback((filter: RequestFilter) => {
    setStatusFilter(filter);
    setPage(1);
  }, []);
  return {
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
  };
}
