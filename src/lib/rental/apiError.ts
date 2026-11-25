// Port of hs-web-app utils/apiError.ts (verbatim; only import paths changed).
import axios from 'axios';

export interface ApiValidationErrorItem {
  field?: string;
  code?: string;
  message: string;
}

/**
 * Trích xuất thông báo lỗi từ response API theo thứ tự ưu tiên:
 * 1. response.data.errors (dạng danh sách validation errors)
 * 2. response.data.message
 * 3. error.message
 * 4. Thông báo mặc định tiếng Việt
 */
export function getApiErrorMessage(
  error: unknown,
  defaultMessage = 'Đã xảy ra lỗi, vui lòng thử lại.'
): string {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as {
      code?: string | number;
      message?: string;
      errors?: ApiValidationErrorItem[];
      detail?: string | Array<{ msg?: string }>;
    };

    // 1. Check response.data.errors
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const messages = data.errors
        .map((err) => (err.field ? `${err.field}: ${err.message}` : err.message))
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.join('; ');
      }
    }

    // 2. Check response.data.message
    if (data.message && typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim();
    if (Array.isArray(data.detail)) {
      const details = data.detail.map((item) => item.msg).filter(Boolean);
      if (details.length) return details.join('; ');
    }
  }

  // 3. Check error.message
  if (error instanceof Error && error.message) {
    return error.message;
  }

  // 4. Default message in Vietnamese
  return defaultMessage;
}
