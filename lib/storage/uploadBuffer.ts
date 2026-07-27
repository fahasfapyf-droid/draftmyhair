import { blobClient } from "./client";
import type { StorageUploadResult } from "./types";

export interface BufferUploadInput {
  buffer: Buffer;
  ownerId: string;
  folder: string;
  filename: string;
  mimeType: string;
}

export async function uploadBufferToStorage({
  buffer,
  ownerId,
  folder,
  filename,
  mimeType,
}: BufferUploadInput): Promise<StorageUploadResult> {
  const storageKey = `users/${ownerId}/${folder}/${filename}`;

  const blob = await blobClient.put(storageKey, buffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: mimeType,
  });

  return {
    storageKey,
    blobUrl: blob.url,
    mimeType,
    fileSize: buffer.length,
  };
}