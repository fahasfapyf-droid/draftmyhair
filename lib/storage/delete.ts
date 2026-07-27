import { blobClient } from "./client";
import type {
  StorageDeleteInput,
  StorageDeleteResult,
} from "./types";

export async function deleteFromStorage({
  blobUrl,
}: StorageDeleteInput): Promise<StorageDeleteResult> {
  await blobClient.del(blobUrl);

  return {
    success: true,
  };
}