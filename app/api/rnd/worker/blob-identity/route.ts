import { NextResponse } from "next/server";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "rnd/agent-learning-deerflow-v1"
  ) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const token = process.env.RND_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "R&D Blob token is not configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  // Match Vercel's read-write token store-ID parser. Never return or log the token.
  const [, , , tokenStoreId = ""] = token.split("_");
  if (
    !token.startsWith("vercel_blob_rw_") ||
    !/^[A-Za-z0-9]+$/.test(tokenStoreId)
  ) {
    return NextResponse.json(
      { error: "R&D Blob token store identity is unavailable" },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    { storeId: `store_${tokenStoreId}` },
    { headers: { "cache-control": "private, no-store" } },
  );
}
