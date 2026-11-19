import { get } from "@vercel/blob";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { requireRndBlobToken } from "@/lib/rnd/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BRANCH = "rnd/agent-learning-deerflow-v1";

// Vercel project SSO protection is enabled for all deployments except custom
// domains. This temporary route is available only on the protected Preview URL.
const EXPECTED = {
  source: {
    pathname:
      "rnd/sources/d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d-50736ff4-39ac-4cac-be66-9b15704fa1c6.webp",
    checksum:
      "d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d",
    size: 1_126_530,
    mimeType: "image/webp",
  },
  output: {
    pathname:
      "rnd/attempts/issue71-authfix-e2e-20261114-j1/1-5cc17b3484669140be0ba6c1bad90aad0853a8cf33cba3d378d7ea91e03c70a2-2c5ee417-bed3-40a9-a1b8-313c9459ebed.jpg",
    checksum:
      "5cc17b3484669140be0ba6c1bad90aad0853a8cf33cba3d378d7ea91e03c70a2",
    size: 2_094_469,
    mimeType: "image/jpeg",
  },
} as const;

const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function unavailable() {
  return new NextResponse("Not found", { status: 404, headers: noStore });
}

function assetErrorCode(error: unknown, label: "source" | "output") {
  const candidate = error instanceof Error ? error.message : "";
  const suffix = candidate.startsWith(label + "_")
    ? candidate.slice(label.length + 1)
    : "";
  return /^(BLOB_GET_FAILED|BLOB_NOT_FOUND|BLOB_RESPONSE_INVALID|BLOB_METADATA_MISMATCH|CHECKSUM_MISMATCH)$/.test(
    suffix,
  )
    ? candidate
    : label + "_UNCLASSIFIED_FAILURE";
}

async function readVerifiedAsset(
  expected: (typeof EXPECTED)["source"] | (typeof EXPECTED)["output"],
  label: "source" | "output",
) {
  let result;
  try {
    result = await get(expected.pathname, {
      access: "private",
      token: requireRndBlobToken(),
    });
  } catch (error) {
    console.error("[rnd-temporary-artifact-recovery] blob_get_failed", {
      asset: label,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw new Error(label + "_BLOB_GET_FAILED");
  }

  if (!result) {
    console.error("[rnd-temporary-artifact-recovery] blob_not_found", {
      asset: label,
    });
    throw new Error(label + "_BLOB_NOT_FOUND");
  }

  if (result.statusCode !== 200 || !result.stream) {
    console.error("[rnd-temporary-artifact-recovery] blob_response_invalid", {
      asset: label,
      statusCode: result.statusCode,
      hasStream: Boolean(result.stream),
    });
    throw new Error(label + "_BLOB_RESPONSE_INVALID");
  }

  if (
    result.blob.pathname !== expected.pathname ||
    result.blob.size !== expected.size ||
    result.blob.contentType !== expected.mimeType
  ) {
    console.error("[rnd-temporary-artifact-recovery] blob_metadata_mismatch", {
      asset: label,
      pathnameMatch: result.blob.pathname === expected.pathname,
      actualSize: result.blob.size,
      expectedSize: expected.size,
      actualContentType: result.blob.contentType,
      expectedContentType: expected.mimeType,
    });
    throw new Error(label + "_BLOB_METADATA_MISMATCH");
  }

  const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");

  if (bytes.byteLength !== expected.size || checksum !== expected.checksum) {
    console.error("[rnd-temporary-artifact-recovery] checksum_mismatch", {
      asset: label,
      actualSize: bytes.byteLength,
      expectedSize: expected.size,
      checksumMatch: checksum === expected.checksum,
    });
    throw new Error(label + "_CHECKSUM_MISMATCH");
  }

  return bytes;
}

function comparisonPage(sourceBytes: Buffer, outputBytes: Buffer) {
  const sourceData =
    "data:" + EXPECTED.source.mimeType + ";base64," + sourceBytes.toString("base64");
  const outputData =
    "data:" + EXPECTED.output.mimeType + ";base64," + outputBytes.toString("base64");

  return [
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">",
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>DMH — November 14 Artifact Recovery</title>",
    "<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#111;color:#f5f5f5;font:14px system-ui,sans-serif}header{max-width:1500px;margin:0 auto 20px}h1{font-size:20px;margin:0 0 6px}p{margin:0;color:#bbb}main{max-width:1500px;margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;background:#202020;border:1px solid #444;border-radius:10px;padding:12px;min-width:0}figcaption{font-weight:650;margin:0 0 10px}img{display:block;width:100%;height:auto;max-height:calc(100vh - 145px);object-fit:contain;background:#000}footer{max-width:1500px;margin:18px auto 0;color:#aaa;font-size:12px}@media(max-width:760px){body{padding:12px}main{grid-template-columns:1fr}img{max-height:none}}</style>",
    "</head><body><header><h1>November 14 — original and generated artifact</h1>",
    "<p>Both private objects were read from the isolated R&amp;D Blob store. Exact byte sizes and SHA-256 hashes passed.</p></header><main>",
    '<figure><figcaption>Original source photograph · WebP · 1,126,530 bytes</figcaption><img alt="Original source photograph" src="',
    sourceData,
    '"></figure><figure><figcaption>Generated result · JPEG · 2,094,469 bytes</figcaption><img alt="Generated result" src="',
    outputData,
    '"></figure></main><footer>Temporary authenticated Preview-only review · No public Blob URLs · No-store response</footer></body></html>',
  ].join("");
}

export async function GET() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== ALLOWED_BRANCH
  ) {
    return unavailable();
  }

  const [sourceResult, outputResult] = await Promise.allSettled([
    readVerifiedAsset(EXPECTED.source, "source"),
    readVerifiedAsset(EXPECTED.output, "output"),
  ]);

  if (sourceResult.status === "rejected" || outputResult.status === "rejected") {
    const sourceCode =
      sourceResult.status === "fulfilled"
        ? "VERIFIED"
        : assetErrorCode(sourceResult.reason, "source");
    const outputCode =
      outputResult.status === "fulfilled"
        ? "VERIFIED"
        : assetErrorCode(outputResult.reason, "output");
    console.error("[rnd-temporary-artifact-recovery] request_failed", {
      sourceCode,
      outputCode,
    });
    return NextResponse.json(
      {
        error: "Private artifact retrieval or integrity verification failed",
        source: sourceCode,
        output: outputCode,
      },
      { status: 502, headers: noStore },
    );
  }

  return new NextResponse(
    comparisonPage(sourceResult.value, outputResult.value),
    {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}
