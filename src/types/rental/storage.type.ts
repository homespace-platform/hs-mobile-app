export type StoragePurpose =
  | 'USER_AVATAR'
  | 'CONTRACT_DOCUMENT'
  | 'IDENTITY_DOCUMENT'
  | 'CHAT_ATTACHMENT'
  | 'PAYMENT_PROOF'
  | 'BRANCH_COVER_IMAGE'
  | 'GENERAL';

export type StorageVisibility = 'PUBLIC' | 'PRIVATE' | 'AUTHENTICATED';

export type StorageStatus = 'PENDING' | 'READY' | 'REJECTED' | 'DELETED';

export type CreateStorageUploadRequest = {
  fileName: string;
  contentType: string;
  size: number;
  purpose: StoragePurpose;
  visibility: StorageVisibility;
  referenceType: string;
  referenceId: string;
};

export type CreateStorageUploadResponse = {
  storageId: string;
  uploadUrl: string;
  method: 'PUT';
  objectKey: string;
  expiresAt: string;
};

export type StorageObjectResponse = {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksum: string | null;
  extension: string | null;
  ownerId: string;
  referenceType: string;
  referenceId: string;
  purpose: StoragePurpose;
  visibility: StorageVisibility;
  status: StorageStatus;
  createdAt: string;
  updatedAt: string;
};

export type StorageUrlResponse = {
  url: string;
  expiresAt: string;
};
