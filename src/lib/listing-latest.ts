// Stale-response protection for the address search and the catalog request (web VietmapAddressPicker).
export const ADDRESS_MIN_QUERY = 2;
export const ADDRESS_DEBOUNCE_MS = 350;
export const ADDRESS_ERROR_MESSAGE = 'Không thể tìm địa chỉ. Vui lòng thử lại.';

/** `next()` aborts the previous request; apply a response only while `isLatest()`. */
export function createLatest() {
  let current: AbortController | undefined;
  return {
    next() {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      return {
        signal: controller.signal,
        isLatest: () => current === controller && !controller.signal.aborted,
      };
    },
    abort: () => current?.abort(),
  };
}
