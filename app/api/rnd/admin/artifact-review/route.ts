import { get } from "@vercel/blob";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BRANCH = "rnd/agent-learning-deerflow-v1";
const REVIEW_ARTIFACT = {
  id: "cmwfycsg80007jp08bqkibotr",
  jobId: "issue71-authfix-e2e-20261114-j1",
  attemptNumber: 1,
  checksum: "5cc17b3484669140be0ba6c1bad90aad0853a8cf33cba3d378d7ea91e03c70a2",
  fileSize: 2_094_469,
  mimeType: "image/jpeg",
} as const;

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  // This one-off review route must never run outside the designated Preview branch.
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== ALLOWED_BRANCH
  ) {
    return notFound();
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }

  // Bind the review to the exact E2E job and attempt that entered HUMAN_APPROVAL.
  const attempt = await prisma.rnDAttempt.findUnique({
    where: {
      jobId_attemptNumber: {
        jobId: REVIEW_ARTIFACT.jobId,
        attemptNumber: REVIEW_ARTIFACT.attemptNumber,
      },
    },
    select: {
      artifactId: true,
      job: { select: { status: true } },
    },
  });

  if (
    !attempt ||
    attempt.job.status !== "HUMAN_APPROVAL" ||
    attempt.artifactId !== REVIEW_ARTIFACT.id
  ) {
    return notFound();
  }

  const asset = await prisma.rnDAsset.findUnique({
    where: { id: REVIEW_ARTIFACT.id },
    select: {
      id: true,
      kind: true,
      storageKey: true,
      mimeType: true,
      fileSize: true,
      checksum: true,
    },
  });

  if (
    !asset ||
    asset.kind !== "GENERATED" ||
    !asset.storageKey.startsWith(
      `rnd/attempts/${REVIEW_ARTIFACT.jobId}/${REVIEW_ARTIFACT.attemptNumber}-`,
    ) ||
    asset.mimeType !== REVIEW_ARTIFACT.mimeType ||
    asset.fileSize !== REVIEW_ARTIFACT.fileSize ||
    asset.checksum !== REVIEW_ARTIFACT.checksum
  ) {
    return notFound();
  }

  try {
    const blob = await get(asset.storageKey, {
      access: "private",
      token: requireRndBlobToken(),
      useCache: false,
    });

    if (
      !blob ||
      blob.statusCode !== 200 ||
      !blob.stream ||
      blob.blob.pathname !== asset.storageKey ||
      blob.blob.size !== REVIEW_ARTIFACT.fileSize ||
      blob.blob.contentType !== REVIEW_ARTIFACT.mimeType
    ) {
      return new NextResponse("Artifact unavailable", {
        status: 502,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }

    const bytes = Buffer.from(
      await new Response(blob.stream).arrayBuffer(),
    );
    const actualChecksum = createHash("sha256").update(bytes).digest("hex");

    if (
      bytes.byteLength !== REVIEW_ARTIFACT.fileSize ||
      actualChecksum !== REVIEW_ARTIFACT.checksum
    ) {
      return new NextResponse("Artifact integrity verification failed", {
        status: 409,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": REVIEW_ARTIFACT.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": 'inline; filename="dmh-issue71-e2e-review.jpg"',
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    // Never expose Blob URLs, credentials, or provider error details.
    return new NextResponse("Artifact retrieval failed", {
      status: 502,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
