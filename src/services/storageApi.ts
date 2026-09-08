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

export async function uploadChatAttachment(
  uri: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
  conversationId: string
): Promise<ChatAttachment> {
  const upload = await axiosClient.post<ApiResponse<UploadResponse>>('/api/v1/storage/uploads', {
    fileName,
    contentType,
    size: sizeBytes,
    purpose: 'CHAT_ATTACHMENT',
    visibility: 'AUTHENTICATED',
    referenceType: 'CHAT_CONVERSATION',
    referenceId: conversationId,
  });
  const fileResponse = await fetch(uri);
  const blob = await fileResponse.blob();
  const putResponse = await fetch(upload.data.result.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResponse.ok) throw new Error('Không thể tải tệp lên S3');

  const completed = await axiosClient.post<ApiResponse<CompletedUpload>>(
    `/api/v1/storage/${upload.data.result.storageId}/complete`,
    {}
  );
  const result = completed.data.result;
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
