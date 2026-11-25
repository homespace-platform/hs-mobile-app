import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { fileSessionGuard, shareRentalFile, withFileLease, writeRentalFile } from './cache';

const UNSUPPORTED = 'Thiết bị chưa hỗ trợ mở hoặc lưu PDF.';

// React Native's Blob has no text()/arrayBuffer(): FileReader is the way to read one.
function read(blob: Blob, as: 'readAsText' | 'readAsDataURL') {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader[as](blob);
  });
}

export const blobText = (blob: Blob) => read(blob, 'readAsText');

/** Writes into a fresh app-private cache folder, keeping the file name for viewers and sharing. */
export async function saveBase64ToCache(base64: string, fileName: string): Promise<string> {
  if (!FileSystem.cacheDirectory) throw new Error(UNSUPPORTED);
  return writeRentalFile(fileName, 'tai-lieu.pdf', async (uri) => {
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  });
}

/** Turns a downloaded PDF into a `file://` URI for the native viewer or the share sheet. */
export async function blobToCacheFile(blob: Blob, fileName: string): Promise<string> {
  const checkSession = fileSessionGuard();
  const dataUrl = await read(blob, 'readAsDataURL');
  checkSession();
  return saveBase64ToCache(dataUrl.slice(dataUrl.indexOf(',') + 1), fileName);
}

/**
 * The device counterpart of a browser download: the user opens or saves the file elsewhere.
 * `wanted` is asked right before the share sheet: the caller's screen may be gone by then.
 */
export async function sharePdf(uri: string, wanted: () => boolean = () => true): Promise<void> {
  const checkSession = fileSessionGuard();
  await withFileLease([uri], async () => {
    if (!(await Sharing.isAvailableAsync())) throw new Error(UNSUPPORTED);
    if (!wanted()) return;
    checkSession();
    await shareRentalFile(uri, () =>
      Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
    );
  });
}
