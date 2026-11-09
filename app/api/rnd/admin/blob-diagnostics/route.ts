import { list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const destinationToken = process.env.RND_BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const sourceStoreId = process.env.BLOB_STORE_ID?.trim() ?? "";
  const destinationStoreId = process.env.BLOB_READ_WRITE_TOKEN_STORE_ID?.trim() ?? "";

  async function probe(token: string) {
    if (!token) return { configured: false, accepted: false, blobCountReturned: 0, sampleHost: null };
    try {
      const result = await list({ limit: 1, token });
      return {
        configured: true,
        accepted: true,
        blobCountReturned: result.blobs.length,
        sampleHost: result.blobs[0] ? new URL(result.blobs[0].url).hostname : null,
      };
    } catch {
      return { configured: true, accepted: false, blobCountReturned: 0, sampleHost: null };
    }
  }

  const [source, destination] = await Promise.all([
    probe(sourceToken),
    probe(destinationToken),
  ]);

  return NextResponse.json({
    ok: true,
    credentials: {
      source: { ...source, storeId: sourceStoreId || null },
      destination: { ...destination, storeId: destinationStoreId || null },
      distinct: Boolean(sourceToken && destinationToken && sourceToken !== destinationToken),
    },
    expected: {
      sourceStoreId: "store_ZjSA3cZUbKwe6YuA",
      destinationStoreId: "store_ErwFOk17AEWS4n1e",
    },
    note: "No Blob objects or database records were modified.",
  }, { headers: { "Cache-Control": "no-store" } });
}
