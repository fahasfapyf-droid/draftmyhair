import { blobClient } from "./client";
import type {
  StorageUploadInput,
  StorageUploadResult,
} from "./types";

export async function uploadToStorage({
  file,
  ownerId,
  folder,
  filename,
}: StorageUploadInput): Promise<StorageUploadResult> {
  const storageKey = filename
    ? `users/${ownerId}/${folder}/${filename}`
    : `users/${ownerId}/${folder}/${crypto.randomUUID()}-${file.name}`;

  const blob = await blobClient.put(storageKey, file, {
    access: "private",
    addRandomSuffix: false,
  });

  return {
    storageKey,
    blobUrl: blob.url,
    mimeType: file.type,
    fileSize: file.size,
  };
}