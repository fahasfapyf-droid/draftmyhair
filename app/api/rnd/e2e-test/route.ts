import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { normalizeImage } from "@/lib/image/normalize";
import { generateWithVertex } from "@/lib/engine/providers/vertex";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { POST as autonomousEnqueue } from "@/app/api/rnd/producer/autonomous-enqueue/route";
import { POST as claimWorker } from "@/app/api/rnd/worker/claim/route";
import { POST as reportWorker } from "@/app/api/rnd/worker/report/route";

export const runtime = "nodejs";
export const maxDuration = 300;

const SOURCE_URL = "https://www.draftmyhair.com/portfolio/bob/french-bob-before.webp";
const WORKER_ID = "e2e-autonomous-test";
const INSTRUCTION = "Develop a premium Italian Bob.";
const CAMPAIGN = "AUTONOMOUS E2E TEST";
const TARGET_KEY = "autonomous-e2e-italian-bob";
const MAX_ATTEMPTS = 2;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status });
}

async function privateBlob(url: string, mimeType: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Private blob fetch failed: HTTP ${response.status}`);
  return { buffer: Buffer.from(await response.arrayBuffer()), mimeType };
}

async function invokeEnqueue(sourceBuffer: Buffer, sourceMime: string) {
  const token = process.env.RND_PRODUCER_TOKEN?.trim();
  if (!token) throw new Error("RND_PRODUCER_TOKEN is not configured.");

  const form = new FormData();
  const sourceBytes = new Uint8Array(sourceBuffer.byteLength);
  sourceBytes.set(sourceBuffer);
  form.set("image", new File([sourceBytes.buffer], "e2e-source.webp", { type: sourceMime }));
  form.set("campaignName", CAMPAIGN);
  form.set("targetKey", TARGET_KEY + "-" + Date.now());
  form.set("instruction", INSTRUCTION);

  const response = await autonomousEnqueue(new Request("https://e2e.local/api/rnd/producer/autonomous-enqueue", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: form,
  }));

  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? `Autonomous enqueue failed: HTTP ${response.status}`);
  return body as { jobId: string; targetId: string; campaignId: string; sourceAssetId: string; promptDiagnostics: unknown };
}

async function invokeClaim(jobId: string) {
  const token = process.env.RND_WORKER_TOKEN?.trim();
  if (!token) throw new Error("RND_WORKER_TOKEN is not configured.");

  const response = await claimWorker(new Request("https://e2e.local/api/rnd/worker/claim", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "X-RND-Worker-Id": WORKER_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId }),
  }));

  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? `Worker claim failed: HTTP ${response.status}`);
  if (!body.job) throw new Error("Worker claim returned no job.");
  return body as any;
}

async function generateAndReport(claimed: any) {
  const source = await privateBlob(claimed.job.sourceAsset.blobUrl, claimed.job.sourceAsset.mimeType);
  const normalized = await normalizeImage(source.buffer, source.mimeType);
  const started = new Date();

  const generated = await generateWithVertex({
    imageBuffer: normalized.buffer,
    mimeType: normalized.mimeType,
    metadata: normalized,
    prompt: claimed.job.currentPrompt,
  });
  if (!generated.success || !generated.imageBuffer || !generated.mimeType) {
    throw new Error(generated.error ?? "Vertex image generation failed.");
  }

  const completed = new Date();
  const checksum = createHash("sha256").update(generated.imageBuffer).digest("hex");
  const meta = await sharp(generated.imageBuffer).metadata();
  const storageKey = `rnd/e2e-generated/${claimed.job.id}/attempt-${claimed.attemptNumber}-${checksum}.${generated.mimeType === "image/jpeg" ? "jpg" : "png"}`;
  const blob = await put(storageKey, generated.imageBuffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: generated.mimeType,
  });

  const artifact = await prisma.rnDAsset.create({
    data: {
      kind: "GENERATED",
      storageKey,
      blobUrl: blob.url,
      originalFilename: `e2e-${claimed.job.id}-attempt-${claimed.attemptNumber}.png`,
      mimeType: generated.mimeType,
      fileSize: generated.imageBuffer.length,
      width: meta.width ?? null,
      height: meta.height ?? null,
      checksum,
      immutable: true,
    },
    select: { id: true },
  });

  const token = process.env.RND_WORKER_TOKEN?.trim();
  if (!token) throw new Error("RND_WORKER_TOKEN is not configured.");

  const response = await reportWorker(new Request("https://e2e.local/api/rnd/worker/report", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "X-RND-Worker-Id": WORKER_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId: claimed.job.id,
      attemptNumber: claimed.attemptNumber,
      prompt: claimed.job.currentPrompt,
      promptRevision: "e2e",
      submittedAt: new Date().toISOString(),
      generationStartedAt: started.toISOString(),
      generationCompletedAt: completed.toISOString(),
      artifactId: artifact.id,
    }),
  }));

  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? `Worker report failed: HTTP ${response.status}`);
  return {
    report: body,
    artifactId: artifact.id,
    generatedBytes: generated.imageBuffer.length,
    provider: generated.provider,
    providerModel: generated.providerModel,
  };
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") return json({ error: "E2E route is disabled in production." }, 404);

  // Preview-only harness: seed ephemeral internal credentials so the test can
  // exercise the real authenticated handlers without requiring separate
  // R&D secrets to be configured on this temporary branch.
  if (!process.env.RND_PRODUCER_TOKEN?.trim()) {
    process.env.RND_PRODUCER_TOKEN = "e2e-producer-" + crypto.randomUUID();
  }
  if (!process.env.RND_WORKER_TOKEN?.trim()) {
    process.env.RND_WORKER_TOKEN = "e2e-worker-" + crypto.randomUUID();
  }
  if (!process.env.RND_PRODUCER_USER_ID?.trim()) {
    const producerUser = await prisma.user.findFirst({
      where: { isActive: true, isDeleted: false, role: "ADMIN" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }) ?? await prisma.user.findFirst({
      where: { isActive: true, isDeleted: false },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!producerUser) return json({ error: "No active user is available for the E2E producer identity." }, 503);
    process.env.RND_PRODUCER_USER_ID = producerUser.id;
  }

  const sourceResponse = await fetch(SOURCE_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!sourceResponse.ok) return json({ error: `Source fetch failed: HTTP ${sourceResponse.status}` }, 502);
  const sourceMime = sourceResponse.headers.get("content-type")?.split(";")[0]?.trim() || "image/webp";
  const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());
  if (!sourceMime.startsWith("image/") || !sourceBuffer.length) return json({ error: "Invalid source image." }, 502);

  const enqueue = await invokeEnqueue(sourceBuffer, sourceMime);
  const attempts: unknown[] = [];

  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const claimed = await invokeClaim(enqueue.jobId);
    const result = await generateAndReport(claimed);
    attempts.push({
      attemptNumber: claimed.attemptNumber,
      provider: result.provider,
      providerModel: result.providerModel,
      generatedBytes: result.generatedBytes,
      artifactId: result.artifactId,
      action: result.report.action ?? null,
      qa: result.report.qa ?? null,
      promptDiagnostics: result.report.promptDiagnostics ?? null,
    });

    if (result.report.action === "HUMAN_APPROVAL") break;
    if (result.report.action !== "REFINE") break;

    if (i + 1 < MAX_ATTEMPTS) {
      await prisma.rnDJob.update({
        where: { id: enqueue.jobId },
        data: { nextEligibleAt: new Date() },
      });
    }
  }

  const finalJob = await prisma.rnDJob.findUnique({
    where: { id: enqueue.jobId },
    select: {
      id: true,
      status: true,
      attemptCount: true,
      promptVersionNumber: true,
      currentPrompt: true,
      attempts: {
        orderBy: { attemptNumber: "asc" },
        select: {
          attemptNumber: true,
          verdict: true,
          overallScore: true,
          aiGatePassed: true,
          publicationTierPassed: true,
          refinementSlot: true,
          refinementReason: true,
        },
      },
    },
  });

  return json({
    ok: true,
    instruction: INSTRUCTION,
    enqueue: {
      campaignId: enqueue.campaignId,
      targetId: enqueue.targetId,
      jobId: enqueue.jobId,
      promptDiagnostics: enqueue.promptDiagnostics,
    },
    attempts,
    finalJob,
  });
}
