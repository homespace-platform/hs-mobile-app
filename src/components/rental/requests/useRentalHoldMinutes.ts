// Port of hs-web-app components/rental-request/useRentalHoldMinutes.ts; null = screens show no number.
import { useEffect, useState } from 'react';

import rentalRequestService from '@/services/rental/rental-request.service';

export function useRentalHoldMinutes() {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    rentalRequestService
      .getPolicy()
      .then((policy) => {
        if (active) setMinutes(Number(policy?.holdMinutes) || null);
      })
      .catch(() => {
        if (active) setMinutes(null);
      });
    return () => {
      active = false;
    };
  }, []);
  return minutes;
}
