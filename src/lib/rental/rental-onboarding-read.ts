// Port of hs-web-app lib/rental-onboarding-read.ts (verbatim; only import paths changed).
import axios from 'axios';
import { rentalOnboardingService } from '@/services/rental/rental-onboarding.service';

/**
 * Read-only fetch for polling and list views: `get` (no server-side sync or row lock), and `refresh` only when the
 * backend has no `get` endpoint (404/405). Any other failure is rethrown so a poll never turns into a write call.
 * Use `refresh` directly when the server must sync stages first.
 */
export const readOnboarding = (id: string) =>
  rentalOnboardingService.get(id).catch((error: unknown) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 404 || status === 405) return rentalOnboardingService.refresh(id);
    throw error;
  });
