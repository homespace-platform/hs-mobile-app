import { apiTransportUrl, webBaseUrl } from '@/config/env';
import type {
  ListingDescriptionRequest,
  ListingDescriptionResponse,
} from '@/lib/listing-description';

/** The web Next.js route (no auth, no Gateway); same contract and 20 s timeout as the web. */
export async function fetchListingDescription(
  body: ListingDescriptionRequest,
  signal: AbortSignal
): Promise<ListingDescriptionResponse> {
  if (!webBaseUrl)
    throw new Error(
      'Chưa cấu hình địa chỉ web (EXPO_PUBLIC_WEB_BASE_URL) nên không tạo được mô tả. Bạn vẫn có thể tự nhập mô tả.'
    );
  const url = `${apiTransportUrl(webBaseUrl).replace(/\/+$/, '')}/api/listing-description`;
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener('abort', abort);
  const timer = setTimeout(abort, 20_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.description) {
      throw new Error(result?.message || 'Không tạo được mô tả. Vui lòng thử lại.');
    }
    return result;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
