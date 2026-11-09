/**
 * R&D Blob isolation guard.
 *
 * Never fall back to BLOB_READ_WRITE_TOKEN: that credential belongs to the
 * general prompt-lab store in Preview. All R&D Blob operations must pass this
 * token explicitly to the SDK or use it for private-blob Bearer requests.
 */
export function requireRndBlobToken(): string {
  const token = process.env.RND_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("RND_BLOB_READ_WRITE_TOKEN is not configured.");
  return token;
}
