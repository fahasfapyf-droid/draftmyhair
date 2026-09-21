import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || "";
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId")?.trim() || "";

  if (!workerId || !jobId) {
    return NextResponse.json({ error: "worker id and jobId are required" }, { status: 400 });
  }

  const job = await prisma.rnDJob.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      leaseOwner: true,
      leaseExpiresAt: true,
      target: {
        select: {
          sourceAsset: {
            select: { blobUrl: true, mimeType: true, originalFilename: true },
          },
        },
      },
    },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (
    job.status !== "PROCESSING" ||
    job.leaseOwner !== workerId ||
    (job.leaseExpiresAt && job.leaseExpiresAt < new Date())
  ) {
    return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json({ error: "Blob storage credentials are not configured" }, { status: 500 });
  }

  const source = await fetch(job.target.sourceAsset.blobUrl, {
    headers: { Authorization: "Bearer " + blobToken },
    cache: "no-store",
  });

  if (!source.ok) {
    return NextResponse.json({ error: "Could not retrieve the private R&D source asset" }, { status: 502 });
  }

  return new Response(source.body, {
    status: 200,
    headers: {
      "content-type": job.target.sourceAsset.mimeType,
      "cache-control": "private, no-store",
      ...(job.target.sourceAsset.originalFilename
        ? { "content-disposition": 'inline; filename="' + job.target.sourceAsset.originalFilename.replace(/["\\]/g, "_") + '"' }
        : {}),
    },
  });
}
