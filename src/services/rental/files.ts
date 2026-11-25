import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
  const directory = `${FileSystem.cacheDirectory}rental-${randomUUID()}/`;
  const name = fileName.split(/[/\\]/).pop()?.trim();
  await FileSystem.makeDirectoryAsync(directory);
  const uri = `${directory}${encodeURIComponent(name && !/^\.+$/.test(name) ? name : 'tai-lieu.pdf')}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

/** Turns a downloaded PDF into a `file://` URI for the native viewer or the share sheet. */
export async function blobToCacheFile(blob: Blob, fileName: string): Promise<string> {
  const dataUrl = await read(blob, 'readAsDataURL');
  return saveBase64ToCache(dataUrl.slice(dataUrl.indexOf(',') + 1), fileName);
}

/** The device counterpart of a browser download: the user opens or saves the file elsewhere. */
export async function sharePdf(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(UNSUPPORTED);
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
