import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import axiosClient from '@/lib/axios-client';
import type { ChatAttachment } from '@/services/chatApi';
import { fileSessionGuard, withFileLease } from '@/services/rental/cache';
import { getStorageViewUrl, type LocalFile } from '@/services/storageApi';
import type { ApiResponse } from '@/types/api';

const CHAT_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const CHAT_DOCUMENT_TYPES = [
  CHAT_MIME_BY_EXTENSION.pdf,
  CHAT_MIME_BY_EXTENSION.doc,
  CHAT_MIME_BY_EXTENSION.docx,
  CHAT_MIME_BY_EXTENSION.xls,
  CHAT_MIME_BY_EXTENSION.xlsx,
  CHAT_MIME_BY_EXTENSION.ppt,
  CHAT_MIME_BY_EXTENSION.pptx,
];

function mediaPath(conversationId: string) {
  return `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/media`;
}

export function chatDocumentFormat(file: Pick<ChatAttachment, 'fileName' | 'contentType'>) {
  if (file.contentType === CHAT_MIME_BY_EXTENSION.pdf) return 'pdf';
  if (file.contentType === CHAT_MIME_BY_EXTENSION.docx) return 'docx';
  if (file.contentType === CHAT_MIME_BY_EXTENSION.doc) return 'doc';
  const extension = file.fileName.split('.').pop()?.toLowerCase();
  if (extension === 'pdf' || extension === 'docx' || extension === 'doc') return extension;
}

export function chatAttachmentIcon(file: Pick<ChatAttachment, 'fileName' | 'contentType'>) {
  const extension = file.fileName.split('.').pop()?.toLowerCase() ?? '';
  if (file.contentType.startsWith('image/')) return 'image-outline';
  if (file.contentType === CHAT_MIME_BY_EXTENSION.pdf || extension === 'pdf')
    return 'document-text-outline';
  if (
    file.contentType === CHAT_MIME_BY_EXTENSION.xls ||
    file.contentType === CHAT_MIME_BY_EXTENSION.xlsx ||
    /^xlsx?$/.test(extension)
  )
    return 'grid-outline';
  if (
    file.contentType === CHAT_MIME_BY_EXTENSION.ppt ||
    file.contentType === CHAT_MIME_BY_EXTENSION.pptx ||
    /^pptx?$/.test(extension)
  )
    return 'easel-outline';
  if (
    file.contentType === CHAT_MIME_BY_EXTENSION.doc ||
    file.contentType === CHAT_MIME_BY_EXTENSION.docx ||
    /^docx?$/.test(extension)
  )
    return 'reader-outline';
  return 'document-outline';
}

export async function prepareChatAttachment(
  file: Omit<LocalFile, 'sizeBytes'> & { sizeBytes?: number }
): Promise<LocalFile> {
  const extension = file.fileName.split('.').pop()?.toLowerCase() ?? '';
  const types = Object.values(CHAT_MIME_BY_EXTENSION);
  const suppliedType = file.contentType.toLowerCase();
  const contentType = types.includes(suppliedType)
    ? suppliedType
    : /^image\/(p?jpeg|(?:x-)?jfif)$/.test(suppliedType)
      ? CHAT_MIME_BY_EXTENSION.jpg
      : !suppliedType || suppliedType === 'application/octet-stream'
        ? CHAT_MIME_BY_EXTENSION[extension]
        : undefined;
  if (!contentType || !types.includes(contentType))
    throw new Error('Chọn ảnh JPG, PNG, WebP hoặc tài liệu PDF, Word, Excel, PowerPoint.');
  if (!file.fileName.trim() || file.fileName.length > 512)
    throw new Error('Tên tệp cần có từ 1 đến 512 ký tự.');
  let sizeBytes = file.sizeBytes;
  if (Platform.OS !== 'web') {
    // ImagePicker can report the original byte count after saving a transformed copy.
    const info = await FileSystem.getInfoAsync(file.uri);
    sizeBytes = info.exists && !info.isDirectory ? info.size : undefined;
  } else if (sizeBytes === undefined) {
    sizeBytes = (await (await fetch(file.uri)).blob()).size;
  }
  if (
    sizeBytes === undefined ||
    !Number.isInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > 25 * 1024 * 1024
  )
    throw new Error('Tệp cần có dung lượng từ 1 byte đến 25 MB.');
  return { ...file, contentType, sizeBytes };
}

export function uploadChatAttachment(conversationId: string, file: LocalFile) {
  const checkSession = fileSessionGuard();
  return withFileLease([file.uri], () => sendChatAttachment(conversationId, file, checkSession));
}

async function sendChatAttachment(
  conversationId: string,
  file: LocalFile,
  checkSession: () => void
) {
  checkSession();
  const path = mediaPath(conversationId);
  const upload = await axiosClient.post<ApiResponse<{ storageId: string; uploadUrl: string }>>(
    `${path}/uploads`,
    { fileName: file.fileName, contentType: file.contentType, size: file.sizeBytes }
  );
  const { storageId, uploadUrl } = upload.data.result;
  const headers = { 'Content-Type': file.contentType };
  checkSession();
  let response: { status: number };
  if (Platform.OS === 'web') {
    const body = await (await fetch(file.uri)).blob();
    checkSession();
    response = await fetch(uploadUrl, { method: 'PUT', headers, body });
  } else {
    response = await FileSystem.uploadAsync(uploadUrl, file.uri, { httpMethod: 'PUT', headers });
  }
  if (response.status < 200 || response.status >= 300)
    throw new Error('Không thể tải tệp lên kho lưu trữ.');
  checkSession();
  const completed = await axiosClient.post<ApiResponse<ChatAttachment>>(
    `${path}/${encodeURIComponent(storageId)}/complete`,
    {}
  );
  return completed.data.result;
}

export async function getChatAttachmentViewUrl(conversationId: string, storageId: string) {
  if (!storageId.startsWith('chat_')) return getStorageViewUrl(storageId);
  const response = await axiosClient.get<ApiResponse<{ url: string }>>(
    `${mediaPath(conversationId)}/${encodeURIComponent(storageId)}/view-url`
  );
  return response.data.result.url;
}
