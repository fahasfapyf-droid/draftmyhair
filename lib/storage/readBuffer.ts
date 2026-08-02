import { get } from "@vercel/blob";

export async function readBufferFromStorage(storageKey: string) {
  const result = await get(storageKey, {
    access: "private",
  });

  if (!result) {
    return null;
  }

  return {
    buffer: Buffer.from(await new Response(result.stream).arrayBuffer()),
    mimeType: result.blob.contentType ?? "application/octet-stream",
  };
}
