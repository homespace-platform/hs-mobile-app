// Port of linkError in hs-web-app components/branch/linkUi.tsx.
import { isAxiosError } from 'axios';

import { getApiErrorMessage } from '@/lib/rental/apiError';

/** The server's own reason when it sends one; otherwise plain Vietnamese. */
export function branchError(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return getApiErrorMessage(error, fallback);
  if (!error.response) return 'Không kết nối được máy chủ.';
  const data = error.response.data as { message?: unknown; errors?: unknown } | undefined;
  return data?.message || data?.errors
    ? getApiErrorMessage(error, fallback)
    : `${fallback} (mã ${error.response.status})`;
}
