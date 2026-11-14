import { get } from "@vercel/blob";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BRANCH = "rnd/agent-learning-deerflow-v1";
const JOB_ID = "issue71-authfix-e2e-20261114-j1";
const TARGET_ID = "issue71-authfix-e2e-20261114-t1";
const EXPECTED = {
  source: {
    id: "cmv6kq8cl0001l206f02g8q1f",
    checksum: "d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d",
    size: 1_126_530,
    mimeType: "image/webp",
  },
  output: {
    id: "cmwfycsg80007jp08bqkibotr",
    checksum: "5cc17b3484669140be0ba6c1bad90aad0853a8cf33cba3d378d7ea91e03c70a2",
    size: 2_094_469,
    mimeType: "image/jpeg",
  },
} as const;

const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function unavailable() {
  return new NextResponse("Not found", { status: 404, headers: noStore });
}

async function readVerifiedAsset(
  storageKey: string,
  expected: typeof EXPECTED.source | typeof EXPECTED.output,
) {
  const blob = await get(storageKey, {
    access: "private",
    token: requireRndBlobToken(),
    useCache: false,
  });

  if (
    !blob ||
    blob.statusCode !== 200 ||
    !blob.stream ||
    blob.blob.pathname !== storageKey ||
    blob.blob.size !== expected.size ||
    blob.blob.contentType !== expected.mimeType
  ) {
    throw new Error("Private asset metadata verification failed");
  }

  const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");

  if (bytes.byteLength !== expected.size || checksum !== expected.checksum) {
    throw new Error("Private asset checksum verification failed");
  }

  return bytes;
}

export async function GET() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== ALLOWED_BRANCH
  ) {
    return unavailable();
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }

  const [job, target, source, outputAttempt] = await Promise.all([
    prisma.rnDJob.findUnique({
      where: { id: JOB_ID },
      select: { status: true, targetId: true },
    }),
    prisma.rnDTarget.findUnique({
      where: { id: TARGET_ID },
      select: { sourceAssetId: true, currentJobId: true },
    }),
    prisma.rnDAsset.findUnique({
      where: { id: EXPECTED.source.id },
      select: { id: true, kind: true, storageKey: true, mimeType: true, fileSize: true, checksum: true },
    }),
    prisma.rnDAttempt.findUnique({
      where: { jobId_attemptNumber: { jobId: JOB_ID, attemptNumber: 1 } },
      select: { artifactId: true },
    }),
  ]);

  if (
    !job ||
    job.status !== "HUMAN_APPROVAL" ||
    job.targetId !== TARGET_ID ||
    !target ||
    target.currentJobId !== JOB_ID ||
    target.sourceAssetId !== EXPECTED.source.id ||
    !source ||
    source.kind !== "SOURCE" ||
    source.mimeType !== EXPECTED.source.mimeType ||
    source.fileSize !== EXPECTED.source.size ||
    source.checksum !== EXPECTED.source.checksum ||
    !outputAttempt ||
    outputAttempt.artifactId !== EXPECTED.output.id
  ) {
    return unavailable();
  }

  const output = await prisma.rnDAsset.findUnique({
    where: { id: EXPECTED.output.id },
    select: { id: true, kind: true, storageKey: true, mimeType: true, fileSize: true, checksum: true },
  });

  if (
    !output ||
    output.kind !== "GENERATED" ||
    !output.storageKey.startsWith("rnd/attempts/" + JOB_ID + "/1-") ||
    output.mimeType !== EXPECTED.output.mimeType ||
    output.fileSize !== EXPECTED.output.size ||
    output.checksum !== EXPECTED.output.checksum
  ) {
    return unavailable();
  }

  try {
    const [sourceBytes, outputBytes] = await Promise.all([
      readVerifiedAsset(source.storageKey, EXPECTED.source),
      readVerifiedAsset(output.storageKey, EXPECTED.output),
    ]);

    const sourceData = "data:" + EXPECTED.source.mimeType + ";base64," + sourceBytes.toString("base64");
    const outputData = "data:" + EXPECTED.output.mimeType + ";base64," + outputBytes.toString("base64");

    const html = [
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">",
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>DMH — E2E Identity Comparison</title>",
      "<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#111;color:#f5f5f5;font:14px system-ui,sans-serif}header{max-width:1500px;margin:0 auto 20px}h1{font-size:20px;margin:0 0 6px}p{margin:0;color:#bbb}main{max-width:1500px;margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;background:#202020;border:1px solid #444;border-radius:10px;padding:12px;min-width:0}figcaption{font-weight:650;margin:0 0 10px}img{display:block;width:100%;height:auto;max-height:calc(100vh - 125px);object-fit:contain;background:#000}footer{max-width:1500px;margin:18px auto 0;color:#aaa;font-size:12px}@media(max-width:760px){body{padding:12px}main{grid-template-columns:1fr}img{max-height:none}}</style>",
      "</head><body><header><h1>Same source, generated hairstyle — direct comparison</h1><p>Exact E2E job: ",
      JOB_ID,
      " · Attempt 1 · Both private assets passed SHA-256 and size verification.</p></header><main>",
      '<figure><figcaption>Original source photograph</figcaption><img alt="Original source photograph" src="',
      sourceData,
      '"></figure><figure><figcaption>Generated Italian Bob</figcaption><img alt="Generated Italian Bob result" src="',
      outputData,
      '"></figure></main><footer>Authenticated administrator review · Preview only · No public Blob URLs · No-store response</footer></body></html>',
    ].join("");

    return new NextResponse(html, {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  } catch {
    return new NextResponse("Private asset retrieval or integrity verification failed", {
      status: 502,
      headers: noStore,
    });
  }
}
