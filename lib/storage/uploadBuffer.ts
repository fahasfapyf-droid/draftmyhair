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

  // Node Buffers can expose SharedArrayBuffer-backed memory in the Vercel
  // runtime. Vercel Blob's fetch path rejects SharedArrayBuffer bodies, so
  // create a normal ArrayBuffer-backed Buffer before uploading.
  const uploadBuffer = Buffer.from(Uint8Array.from(buffer));

  const blob = await blobClient.put(storageKey, uploadBuffer, {
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
