export interface StorageUploadInput {
  file: File;
  ownerId: string;
  folder: string;
  filename?: string;
}

export interface StorageUploadResult {
  storageKey: string;
  blobUrl: string;
  mimeType: string;
  fileSize: number;
}

export interface StorageDeleteInput {
  blobUrl: string;
}

export interface StorageDeleteResult {
  success: true;
}