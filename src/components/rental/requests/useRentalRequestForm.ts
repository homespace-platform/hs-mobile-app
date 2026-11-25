// State, estimate and submit of hs-web-app components/rental-request/RentalRequestModal.tsx.
// The hook lives as long as the open modal, so every open starts from the web's reset values. The
// contact fields and the submit lock live outside it, because on web they survive closing.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useDialog } from '@/components/AppDialog';
import { hasProfileGateNotice } from '@/lib/profile-gate-signal';
import { getAccessToken } from '@/features/auth/session';
import { numberVi } from '@/lib/rental/format';
import {
  clampAfterEstimate,
  createRentalRequestBody,
  defaultLeaseMonths,
  depositInfo,
  ESTIMATE_ERROR_FALLBACK,
  estimateKey,
  estimateRequest,
  validateRentalRequest,
  type EstimateInput,
} from '@/lib/rental/RentalRequestModal';
import {
  clampOccupants,
  normalizeOccupantLimit,
  resolveOccupantLimit,
  type RentalOccupantLimitSnapshot,
} from '@/lib/rental/rental-occupant-limit';
import rentalRequestService from '@/services/rental/rental-request.service';
import { getUserProfileApi } from '@/services/userApi';
import type {
  RentalEstimateResponse,
  RentalRequestResponse,
} from '@/types/rental/rental-request.type';

import {
  inputConstraintError,
  prefillContact,
  submitErrorMessage,
  submitKey,
  submitLocks,
  tokenSubject,
  type ContactDraft,
} from './logic';
import { useViewer } from './useViewer';

export type RentalRequestFormInput = {
  onClose: () => void;
  listingId: string;
  listingPrice: number;
  depositType?: string;
  listingDepositAmount?: number | null;
  depositMonths?: number | null;
  minimumLeaseMonths: number;
  listingMaxOccupants?: number | null;
  onSuccess?: (request: RentalRequestResponse) => void;
  /** Owned by the caller and updated in place, so it outlives the sheet. */
  contact: ContactDraft;
};

const POLICY_ERROR = 'Chưa tải được điều kiện giữ chỗ. Hãy mở lại trước khi gửi yêu cầu.';

export function useRentalRequestForm(input: RentalRequestFormInput) {
  const { listingId, listingPrice, minimumLeaseMonths } = input;
  const showDialog = useDialog();

  const [moveInDate, setMoveInDate] = useState(() => new Date());
  const [leaseMonths, setLeaseMonthsState] = useState(() => defaultLeaseMonths(minimumLeaseMonths));
  const [monthsInput, setMonthsInput] = useState(() => String(leaseMonths));
  const [occupantCount, setOccupantCount] = useState(1);
  const [limitSnapshot, setLimitSnapshot] = useState<RentalOccupantLimitSnapshot | null>(null);
  const occupantLimit = resolveOccupantLimit(listingId, input.listingMaxOccupants, limitSnapshot);
  const [motorbikeCount, setMotorbikeCount] = useState(0);
  const [carCount, setCarCount] = useState(0);
  const draft = input.contact;
  const [contact, setContact] = useState<ContactDraft>(() => ({ ...draft }));
  const editContact = useCallback(
    (patch: ContactDraft) => {
      Object.assign(draft, patch);
      setContact({ ...draft });
    },
    [draft]
  );
  const { renterName = '', renterPhone = '', renterEmail = '' } = contact;
  const [renterNote, setRenterNote] = useState('');
  const [customDepositInput, setCustomDepositInput] = useState(() =>
    listingPrice ? numberVi(listingPrice) : ''
  );
  const [accepted, setAccepted] = useState(false);
  const [policy, setPolicy] = useState<{ version: string; text: string } | null>(null);
  const { userId } = useViewer();
  const isSubmitting = useSyncExternalStore(submitLocks.subscribe, () =>
    submitLocks.has(submitKey(userId, listingId))
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    rentalRequestService
      .getReservationPolicy()
      .then((value) => {
        if (active) setPolicy(value);
      })
      .catch(() => {
        if (active) showDialog('Thông báo', POLICY_ERROR);
      });
    return () => {
      active = false;
    };
  }, [showDialog]);

  // Only fills the contact fields: without the profile they simply stay as they are, as on web.
  useEffect(() => {
    let active = true;
    getUserProfileApi()
      .then((profile) => {
        if (active) editContact(prefillContact(draft, profile));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [draft, editContact]);

  const deposit = depositInfo({
    listingPrice,
    depositType: input.depositType,
    listingDepositAmount: input.listingDepositAmount,
    depositMonths: input.depositMonths,
    customDepositInput,
  });

  // Backend estimate, 250 ms after the last change. A result only counts while its key matches.
  const estimateInput: EstimateInput = {
    listingId,
    moveInDate,
    leaseMonths,
    occupantCount,
    motorbikeCount,
    carCount,
    deposit,
  };
  const key = estimateKey(estimateInput);
  const [estimateResult, setEstimateResult] = useState<RentalEstimateResponse | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateFailure, setEstimateFailure] = useState<string | null>(null);
  const [estimateFor, setEstimateFor] = useState<string | null>(null);
  const estimate = estimateFor === key ? estimateResult : null;
  const estimateError = estimateFor === key ? estimateFailure : null;
  const loadingEstimate = estimateFor !== key || estimateLoading;

  const latestInput = useRef(estimateInput);
  useEffect(() => {
    latestInput.current = estimateInput;
  });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const sent = latestInput.current;
      setEstimateLoading(true);
      setEstimateFailure(null);
      rentalRequestService
        .estimateRentalCost(estimateRequest(sent))
        .then((res) => {
          if (!active) return;
          setEstimateResult(res);
          setEstimateFor(key);
          setEstimateLoading(false);
          // The capacity outlives a pending or failed quote; prices do not.
          setLimitSnapshot({
            listingId: sent.listingId,
            limit: normalizeOccupantLimit(res.occupantLimit),
          });
          const next = clampAfterEstimate(res, sent);
          setOccupantCount(next.occupantCount);
          setMotorbikeCount(next.motorbikeCount);
          setCarCount(next.carCount);
        })
        .catch((error: { response?: { data?: { message?: string } } }) => {
          if (!active) return;
          setEstimateResult(null);
          setEstimateFor(key);
          setEstimateLoading(false);
          setEstimateFailure(error?.response?.data?.message || ESTIMATE_ERROR_FALLBACK);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  /** Quick buttons and steppers set the number and the box together. */
  const setLeaseMonths = (months: number) => {
    setLeaseMonthsState(months);
    setMonthsInput(String(months));
  };
  const typeMonths = (text: string, months: number | null) => {
    setMonthsInput(text);
    if (months !== null) setLeaseMonthsState(months);
  };

  const capVehicles = (limit: number) => {
    setMotorbikeCount((count) => Math.min(count, limit));
    setCarCount((count) => Math.min(count, limit));
  };
  const typeOccupants = (text: string) => {
    if (text === '') return setOccupantCount(0);
    const next = clampOccupants(Number(text), occupantLimit);
    setOccupantCount(next);
    capVehicles(next);
  };
  const blurOccupants = () => {
    const next = clampOccupants(occupantCount, occupantLimit);
    setOccupantCount(next);
    capVehicles(next);
  };
  const stepOccupants = (delta: 1 | -1) => {
    if (delta === 1)
      return setOccupantCount(clampOccupants((occupantCount || 0) + 1, occupantLimit));
    const next = Math.max(1, (occupantCount || 1) - 1);
    setOccupantCount(next);
    capVehicles(next);
  };

  async function submit() {
    if (isSubmitting) return;
    const constraint = inputConstraintError({
      monthsInput,
      leaseMonths,
      minimumLeaseMonths,
      occupantCount,
      occupantLimit,
      renterName,
      renterPhone,
      renterEmail,
    });
    if (constraint) return showDialog('Thông báo', constraint);
    const problem = validateRentalRequest({
      reservationPolicyAccepted: accepted,
      reservationPolicy: policy,
      moveInDate,
      loadingEstimate,
      estimateError,
      estimate,
      leaseMonths,
      minimumLeaseMonths,
      occupantCount,
      occupantLimit,
      motorbikeCount,
      carCount,
      renterName,
      renterPhone,
    });
    if (problem) return showDialog('Thông báo', problem);
    // The session is read here too: the id above may not have arrived in a just reopened form.
    const renter = userId ?? tokenSubject(await getAccessToken());
    const release = submitLocks.acquire(submitKey(renter, listingId));
    if (!release) return;
    try {
      const created = await rentalRequestService.createRentalRequest(
        createRentalRequestBody({
          listingId,
          moveInDate,
          leaseMonths,
          occupantCount,
          motorbikeCount,
          carCount,
          renterName,
          renterPhone,
          renterEmail,
          renterNote,
          estimate,
          deposit,
          reservationPolicyAccepted: accepted,
          reservationPolicyVersion: policy!.version,
        })
      );
      showDialog(
        'Thành công',
        'Gửi yêu cầu thuê nhà thành công! Chủ nhà sẽ nhận được thông báo để xem xét.',
        undefined,
        'success'
      );
      input.onSuccess?.(created);
      // A form closed while sending must not close the one opened after it.
      if (mounted.current) input.onClose();
    } catch (error) {
      if (!hasProfileGateNotice(error)) showDialog('Thông báo', submitErrorMessage(error));
    } finally {
      release();
    }
  }

  return {
    moveInDate,
    setMoveInDate,
    leaseMonths,
    monthsInput,
    setMonthsInput,
    setLeaseMonths,
    typeMonths,
    occupantCount,
    occupantLimit,
    typeOccupants,
    blurOccupants,
    stepOccupants,
    motorbikeCount,
    setMotorbikeCount,
    carCount,
    setCarCount,
    renterName,
    setRenterName: (value: string) => editContact({ renterName: value }),
    renterPhone,
    setRenterPhone: (value: string) => editContact({ renterPhone: value }),
    renterEmail,
    setRenterEmail: (value: string) => editContact({ renterEmail: value }),
    renterNote,
    setRenterNote,
    customDepositInput,
    setCustomDepositInput,
    deposit,
    depositAmount: estimate?.depositAmount ?? deposit.amount,
    accepted,
    setAccepted,
    policy,
    estimate,
    estimateError,
    loadingEstimate,
    isSubmitting,
    submit,
  };
}

export type RentalRequestForm = ReturnType<typeof useRentalRequestForm>;
