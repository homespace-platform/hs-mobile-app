// Port of the helpers in hs-web-app components/rental-request/RentalPaymentModal.tsx:54-66 and the proof
// file checks of handleFileSelected (:312-338). formatCountdown belongs to the MOBILE_QR mode, which mobile drops (Q2).
import { currencyVnd } from '@/lib/rental/format';

export const formatVND = (amount: number): string => currencyVnd(amount);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const PROOF_MAX_BYTES = 15 * 1024 * 1024;
export const PROOF_REJECTED_TOAST = 'Chứng từ chưa được gửi vì tệp không hợp lệ.';

/** Inline error for a picked proof file (show PROOF_REJECTED_TOAST too), or null when it may be uploaded. */
export function proofFileError(file: { type: string; size: number }): string | null {
  if (!PROOF_MIME_TYPES.includes(file.type))
    return 'Chỉ chấp nhận tệp định dạng ảnh (JPEG, PNG, WebP) hoặc PDF.';
  if (file.size > PROOF_MAX_BYTES) return 'Kích thước tệp chứng từ không được vượt quá 15MB.';
  return null;
}
