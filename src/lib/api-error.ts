import { isAxiosError } from 'axios';

export function apiError(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    if (error.response?.data?.message) return error.response.data.message;
    if (!error.response) return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
  }
  return error instanceof Error
    ? error.message
    : 'Không thực hiện được thao tác. Vui lòng thử lại.';
}
