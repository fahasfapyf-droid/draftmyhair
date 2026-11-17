import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { del, get, put } from "@vercel/blob";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "rnd/validation/";
const CONTENT_TYPE = "application/octet-stream";
const APPROVED_BRANCH = "rnd/agent-learning-deerflow-v1";

function authorized(request: Request): boolean {
  const expected = process.env.RND_BLOB_VALIDATION_SECRET;
  const supplied = request.headers.get("x-rnd-validation-secret");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function previewBranchAllowed(): boolean {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === APPROVED_BRANCH;
}

export async function POST(request: Request) {
  if (!previewBranchAllowed()) {
    return NextResponse.json({ code: "RND_VALIDATION_PREVIEW_ONLY" }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!authorized(request)) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let token: string;
  try {
    token = requireRndBlobToken();
  } catch {
    return NextResponse.json({ code: "RND_BLOB_CREDENTIAL_UNAVAILABLE" }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "30" },
    });
  }

  const pathname = `${PREFIX}${randomUUID()}.bin`;
  const bytes = Buffer.from("draft-my-hair-rnd-blob-validation-v1");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  let uploaded: Awaited<ReturnType<typeof put>> | null = null;
  let uploadAttempted = false;
  let readBackVerified = false;
  let deletionVerified = false;
  let cleanupFailed = false;

  try {
    uploadAttempted = true;
    uploaded = await put(pathname, bytes, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: CONTENT_TYPE,
      token,
    });

    const stored = await get(pathname, { access: "private", token, useCache: false });
    if (!stored || stored.statusCode !== 200 || stored.blob.pathname !== pathname ||
        stored.blob.contentType !== CONTENT_TYPE || stored.blob.size !== bytes.byteLength || !stored.stream) {
      throw new Error("RND_VALIDATION_READBACK_METADATA_MISMATCH");
    }

    const readBytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
    const readChecksum = createHash("sha256").update(readBytes).digest("hex");
    if (readBytes.byteLength !== bytes.byteLength || readChecksum !== checksum) {
      throw new Error("RND_VALIDATION_CHECKSUM_MISMATCH");
    }
    readBackVerified = true;
  } catch {
    // Provider details and credentials are intentionally not exposed.
  } finally {
    if (uploadAttempted) {
      try {
        await del(uploaded?.url ?? pathname, uploaded ? { token, ifMatch: uploaded.etag } : { token });
        deletionVerified = (await get(pathname, { access: "private", token, useCache: false })) === null;
        cleanupFailed = !deletionVerified;
      } catch {
        cleanupFailed = true;
      }
    } else {
      deletionVerified = true;
    }
  }

  if (!readBackVerified || cleanupFailed || !deletionVerified) {
    return NextResponse.json({
      ok: false,
      uploadAttempted,
      readBackVerified,
      deletionVerified,
      cleanupFailed,
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    ok: true,
    storagePrefix: PREFIX,
    readBackVerified,
    checksumVerified: true,
    deletionVerified,
    cleanupFailed: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
