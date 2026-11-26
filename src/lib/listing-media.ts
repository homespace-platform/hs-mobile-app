// Media limits (web BasicInfoSection) and upload with retry that never re-uploads a stored file.
import type { BasicInfoData, ListingMediaItem } from '@/lib/listing-form';
import type { UploadedListingMedia } from '@/lib/listing-payload';
import type { LocalFile } from '@/services/storageApi';

export const MAX_IMAGES = 6;
export const MAX_VIDEOS = 3;
export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 2 * 60;

export type ListingMediaKind = 'IMAGE' | 'VIDEO';
/** Shape of an expo-image-picker asset (`duration` in milliseconds). */
export type PickedAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  duration?: number | null;
};

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};
const TYPES: Record<ListingMediaKind, string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
};

export const mediaSlotsLeft = (basicInfo: BasicInfoData, kind: ListingMediaKind) =>
  Math.max(
    0,
    kind === 'IMAGE' ? MAX_IMAGES - basicInfo.images.length : MAX_VIDEOS - basicInfo.videos.length
  );

/** Appends what fits and passes the limits; every rejected file gets one message. */
export function addPickedMedia(
  basicInfo: BasicInfoData,
  kind: ListingMediaKind,
  assets: PickedAsset[]
): { basicInfo: BasicInfoData; errors: string[] } {
  const errors: string[] = [];
  const added: ListingMediaItem[] = [];
  for (const asset of assets.slice(0, mediaSlotsLeft(basicInfo, kind))) {
    const uriName = asset.uri.split('/').pop()?.split('?')[0] ?? '';
    const name = asset.fileName || uriName || (kind === 'IMAGE' ? 'Ảnh.jpg' : 'Video.mp4');
    const reported = asset.mimeType?.trim().toLowerCase();
    const contentType =
      reported && reported !== 'application/octet-stream'
        ? reported
        : (TYPE_BY_EXTENSION[name.split('.').pop()!.toLowerCase()] ?? '');
    const size = asset.fileSize ?? 0;
    if (!(size > 0)) errors.push(`Không đọc được dung lượng tệp ${name}. Vui lòng chọn lại.`);
    else if (!TYPES[kind].includes(contentType))
      errors.push(
        kind === 'IMAGE'
          ? `${name}: ảnh phải là JPG/PNG/WebP.`
          : `${name}: video phải là MP4/WebM/MOV.`
      );
    else if (kind === 'IMAGE' && size > MAX_IMAGE_SIZE_BYTES)
      errors.push(`${name} vượt quá giới hạn 25MB.`);
    else if (kind === 'VIDEO' && size > MAX_VIDEO_SIZE_BYTES)
      errors.push(`${name} vượt quá giới hạn 500MB.`);
    else if (kind === 'VIDEO' && !Number.isFinite(asset.duration ?? NaN))
      errors.push(`Không thể đọc video ${name}.`);
    else if (kind === 'VIDEO' && asset.duration! > MAX_VIDEO_DURATION_SECONDS * 1000)
      errors.push(`${name} dài quá 2 phút.`);
    else
      added.push({
        name,
        uri: asset.uri,
        file: { uri: asset.uri, fileName: name, contentType, sizeBytes: size },
      });
  }
  const key = kind === 'IMAGE' ? 'images' : 'videos';
  return {
    basicInfo: added.length ? { ...basicInfo, [key]: [...basicInfo[key], ...added] } : basicInfo,
    errors,
  };
}

export function removeMedia(
  basicInfo: BasicInfoData,
  kind: ListingMediaKind,
  index: number
): BasicInfoData {
  const key = kind === 'IMAGE' ? 'images' : 'videos';
  return { ...basicInfo, [key]: basicInfo[key].filter((_, i) => i !== index) };
}

/** Records the storage id so a retry after a later failure does not upload the file again. */
export function markUploaded(
  basicInfo: BasicInfoData,
  kind: ListingMediaKind,
  index: number,
  storageObjectId: string
): BasicInfoData {
  const key = kind === 'IMAGE' ? 'images' : 'videos';
  return {
    ...basicInfo,
    [key]: basicInfo[key].map((item, i) => (i === index ? { ...item, storageObjectId } : item)),
  };
}

/** Sequential, images first: this order is the payload order (first image is the cover). */
export async function uploadListingMedia(
  basicInfo: BasicInfoData,
  upload: (file: LocalFile, kind: ListingMediaKind) => Promise<string>,
  onUploaded?: (kind: ListingMediaKind, index: number, storageObjectId: string) => void
): Promise<UploadedListingMedia[]> {
  const all = [
    ...basicInfo.images.map((item, index) => ({ item, index, mediaType: 'IMAGE' as const })),
    ...basicInfo.videos.map((item, index) => ({ item, index, mediaType: 'VIDEO' as const })),
  ];
  // Checked before any upload: dropping a file silently would delete it from the listing.
  if (all.some(({ item }) => !item.sourceMediaId && !item.storageObjectId && !item.file))
    throw new Error(
      'Tin đăng có tệp chưa xác định. Vui lòng xóa tệp đó và tải lại, hoặc cập nhật trên web.'
    );
  const result: UploadedListingMedia[] = [];
  for (const { item, index, mediaType } of all) {
    if (item.sourceMediaId) result.push({ sourceMediaId: item.sourceMediaId, mediaType });
    else if (item.storageObjectId)
      result.push({ storageObjectId: item.storageObjectId, mediaType });
    else {
      const storageObjectId = await upload(item.file!, mediaType);
      onUploaded?.(mediaType, index, storageObjectId);
      result.push({ storageObjectId, mediaType });
    }
  }
  return result;
}
