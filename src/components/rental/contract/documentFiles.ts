// Device side of the web's "open the signed URL in a new tab": download into the app cache, then show
// it in the viewer or hand it to the phone's apps.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  discardRentalFile,
  fileSessionGuard,
  shareRentalFile,
  writeRentalFile,
} from '@/services/rental/cache';
import { contractService } from '@/services/rental/contract.service';
import type { ContractDocumentResponse } from '@/types/rental/contract.type';

import { isDocx } from './signingLogic';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const documentFileName = (doc: ContractDocumentResponse) =>
  doc.fileName || `Hop_dong_${doc.documentType}.${doc.documentType?.toLowerCase()}`;

/** A short-lived storage URL: no auth header, so the app token never leaves for the storage host. */
export async function downloadUrlToCache(
  url: string,
  doc: ContractDocumentResponse
): Promise<string> {
  const fail = (status?: number) =>
    new Error(
      status && isDocx(doc)
        ? `Tải tệp DOCX thất bại (HTTP ${status})`
        : 'Không thể tải nội dung tài liệu.'
    );
  let status: number | undefined;
  try {
    // A failed or partial download is not kept.
    return await writeRentalFile(documentFileName(doc), 'tai-lieu', async (target) => {
      const result = await FileSystem.downloadAsync(url, target);
      if (result.status < 200 || result.status >= 300) {
        status = result.status;
        throw fail(status);
      }
      return result.uri;
    });
  } catch {
    // The native error is English and may quote the signed URL.
    throw fail(status);
  }
}

/** DOCX and other files the app cannot draw: the user opens or saves them with another app. */
export async function openWithDeviceApps(url: string, doc: ContractDocumentResponse) {
  const checkSession = fileSessionGuard();
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Thiết bị chưa hỗ trợ mở hoặc lưu tài liệu.');
  checkSession();
  const uri = await downloadUrlToCache(url, doc);
  try {
    checkSession();
    await shareRentalFile(uri, () =>
      Sharing.shareAsync(uri, {
        mimeType: isDocx(doc) ? DOCX_MIME : doc.documentType === 'PDF' ? 'application/pdf' : '*/*',
        dialogTitle: 'Mở hoặc lưu tài liệu',
      })
    );
  } finally {
    await discardRentalFile(uri);
  }
}

export const shareSignedDocument = contractService.downloadDocument;
