import * as FileSystem from 'expo-file-system/legacy';

import { getStorageViewUrl, listUserAvatars, type LocalFile } from '@/services/storageApi';
import type { ApiResponse } from '@/types/api';
import type {
  CreateStorageUploadRequest,
  CreateStorageUploadResponse,
  StorageObjectResponse,
} from '@/types/rental/storage.type';

import { fileSessionGuard, withFileLease } from './cache';
import axiosClient from './client';

// Not storageApi.uploadFile: it has no GENERAL purpose, returns another shape and drops the
// file name and status from the upload error.

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const EVIDENCE_ERROR = 'Minh chứng cần là ảnh JPG/PNG/WebP hoặc PDF, tối đa 15 MB/tệp.';

type Target = Pick<
  CreateStorageUploadRequest,
  'purpose' | 'visibility' | 'referenceType' | 'referenceId'
>;

function resolveContentType(file: LocalFile): string {
  const reportedType = file.contentType.trim().toLowerCase();
  if (reportedType && reportedType !== 'application/octet-stream') {
    return reportedType;
  }

  const extension = file.fileName.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

// ImagePicker can report the original byte count after saving a transformed copy, so the size
// that is checked and declared comes from the file itself, like the web's File.size.
async function fileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory ? info.size : 0;
}

async function uploadFile(
  file: LocalFile,
  size: number,
  target: Target,
  checkSession: () => void
): Promise<string> {
  checkSession();
  const contentType = resolveContentType(file);
  const upload = await axiosClient.post<ApiResponse<CreateStorageUploadResponse>>(
    '/api/v1/storage/uploads',
    { fileName: file.fileName, contentType, size, ...target }
  );
  const { storageId, uploadUrl } = upload.data.result;

  checkSession();
  const s3Response = await FileSystem.uploadAsync(uploadUrl, file.uri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType },
  });
  if (s3Response.status < 200 || s3Response.status >= 300) {
    throw new Error(`Không thể tải tệp ${file.fileName} lên kho lưu trữ (${s3Response.status}).`);
  }

  checkSession();
  await axiosClient.post<ApiResponse<unknown>>(`/api/v1/storage/${storageId}/complete`, {});
  return storageId;
}

async function upload(file: LocalFile, target: Target) {
  const checkSession = fileSessionGuard();
  return withFileLease([file.uri], async () =>
    uploadFile(file, await fileSize(file.uri), target, checkSession)
  );
}

async function uploadEvidence(
  file: LocalFile,
  referenceType: string,
  referenceId: string,
  invalid = EVIDENCE_ERROR
) {
  const checkSession = fileSessionGuard();
  return withFileLease([file.uri], async () => {
    const size = await fileSize(file.uri);
    if (!EVIDENCE_TYPES.includes(resolveContentType(file)) || size <= 0 || size > 15 * 1024 * 1024)
      throw new Error(invalid);
    return uploadFile(
      file,
      size,
      {
        purpose: 'GENERAL',
        visibility: 'PRIVATE',
        referenceType,
        referenceId,
      },
      checkSession
    );
  });
}

const storageService = {
  async uploadComplaintEvidence(file: LocalFile, rentalId: string): Promise<string> {
    return uploadEvidence(
      file,
      'RENTAL_COMPLAINT_EVIDENCE',
      rentalId,
      'Chứng cứ cần là ảnh JPG/PNG/WebP hoặc PDF, tối đa 15 MB/tệp.'
    );
  },
  async uploadAmendmentEvidence(file: LocalFile, contractId: string): Promise<string> {
    return uploadEvidence(file, 'CONTRACT_AMENDMENT_EVIDENCE', contractId);
  },
  async uploadClosureEvidence(file: LocalFile, contractId: string): Promise<string> {
    return uploadEvidence(file, 'CONTRACT_CLOSURE_EVIDENCE', contractId);
  },
  async getPaymentProofViewUrl(storageId: string): Promise<string> {
    return getStorageViewUrl(storageId);
  },
  async uploadUserAvatar(file: LocalFile, userId: string): Promise<string> {
    return upload(file, {
      purpose: 'USER_AVATAR',
      visibility: 'PUBLIC',
      referenceType: 'USER',
      referenceId: userId,
    });
  },

  async listUserAvatars(userId: string, page = 1, size = 20): Promise<StorageObjectResponse[]> {
    return (await listUserAvatars(userId, page, size)) as StorageObjectResponse[];
  },

  async getViewUrl(storageId: string): Promise<string> {
    return getStorageViewUrl(storageId);
  },

  async uploadListingMedia(file: LocalFile, referenceId = 'listing'): Promise<string> {
    return upload(file, {
      purpose: 'GENERAL',
      visibility: 'PUBLIC',
      referenceType: 'LISTING',
      referenceId,
    });
  },

  // uploadFile resolves the content type from the file itself (extension fallback), as on web.
  async uploadPaymentProof(file: LocalFile, paymentRequestId: string): Promise<string> {
    return upload(file, {
      purpose: 'PAYMENT_PROOF',
      visibility: 'PRIVATE',
      referenceType: 'PAYMENT_REQUEST',
      referenceId: paymentRequestId,
    });
  },

  async uploadBranchCoverImage(file: LocalFile, branchId = 'branch'): Promise<string> {
    return upload(file, {
      purpose: 'BRANCH_COVER_IMAGE',
      visibility: 'PUBLIC',
      referenceType: 'BRANCH',
      referenceId: branchId,
    });
  },
};

export default storageService;
