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
  // make an independent Uint8Array copy backed by a normal ArrayBuffer.
  const uploadBytes = Uint8Array.from(buffer);

  const blob = await blobClient.put(storageKey, uploadBytes, {
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
