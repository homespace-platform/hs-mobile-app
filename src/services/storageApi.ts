import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';
import type { ChatAttachment } from '@/services/chatApi';

type UploadResponse = {
  storageId: string;
  uploadUrl: string;
};

type CompletedUpload = {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

export type LocalFile = { uri: string; fileName: string; contentType: string; sizeBytes: number };

export async function uploadFile(
  file: LocalFile,
  metadata: {
    purpose:
      | 'CHAT_ATTACHMENT'
      | 'USER_AVATAR'
      | 'PAYMENT_PROOF'
      | 'BRANCH_COVER_IMAGE'
      | 'LISTING_IMAGE'
      | 'LISTING_VIDEO';
    visibility: 'AUTHENTICATED' | 'PUBLIC' | 'PRIVATE';
    referenceType: string;
    referenceId: string;
  }
): Promise<CompletedUpload> {
  const maxMb =
    metadata.purpose === 'USER_AVATAR'
      ? 5
      : metadata.purpose === 'LISTING_VIDEO'
        ? 500
        : metadata.purpose === 'PAYMENT_PROOF' || metadata.purpose === 'BRANCH_COVER_IMAGE'
          ? 15
          : 25;
  if (
    !Number.isFinite(file.sizeBytes) ||
    file.sizeBytes <= 0 ||
    file.sizeBytes > maxMb * 1024 * 1024
  )
    throw new Error(`Tệp cần có dung lượng từ 1 byte đến ${maxMb} MB.`);
  if (
    metadata.purpose === 'PAYMENT_PROOF' &&
    !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.contentType)
  )
    throw new Error('Chứng từ phải là ảnh JPG/PNG/WebP hoặc PDF.');
  if (
    (metadata.purpose === 'USER_AVATAR' ||
      metadata.purpose === 'BRANCH_COVER_IMAGE' ||
      metadata.purpose === 'LISTING_IMAGE') &&
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.contentType)
  )
    throw new Error('Ảnh phải là JPG/PNG/WebP.');
  if (
    metadata.purpose === 'LISTING_VIDEO' &&
    !['video/mp4', 'video/webm', 'video/quicktime'].includes(file.contentType)
  )
    throw new Error('Video phải là MP4, WebM hoặc MOV.');
  const upload = await axiosClient.post<ApiResponse<UploadResponse>>('/api/v1/storage/uploads', {
    fileName: file.fileName,
    contentType: file.contentType,
    size: file.sizeBytes,
    ...metadata,
  });
  const blob = await (await fetch(file.uri)).blob();
  const response = await fetch(upload.data.result.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.contentType },
    body: blob,
  });
  if (!response.ok) throw new Error('Không thể tải tệp lên kho lưu trữ.');
  return (
    await axiosClient.post<ApiResponse<CompletedUpload>>(
      `/api/v1/storage/${encodeURIComponent(upload.data.result.storageId)}/complete`,
      {}
    )
  ).data.result;
}

export async function uploadChatAttachment(
  uri: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
  conversationId: string
): Promise<ChatAttachment> {
  const result = await uploadFile(
    { uri, fileName, contentType, sizeBytes },
    {
      purpose: 'CHAT_ATTACHMENT',
      visibility: 'AUTHENTICATED',
      referenceType: 'CHAT_CONVERSATION',
      referenceId: conversationId,
    }
  );
  return {
    storageId: result.id,
    fileName: result.originalName,
    contentType: result.contentType,
    sizeBytes: result.sizeBytes,
  };
}

export async function getStorageViewUrl(storageId: string) {
  const response = await axiosClient.get<ApiResponse<{ url: string }>>(
    `/api/v1/storage/${encodeURIComponent(storageId)}/view-url`
  );
  return response.data.result.url;
}
