import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { buildRndPrompt } from "@/lib/rnd/prompt";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const ALLOWED_SOURCE_HOSTS = new Set(["www.draftmyhair.com", "draftmyhair.com"]);
const TEST_TARGET_PREFIX = "task3-approval-fence-fixture-";

export async function POST(request: Request) {
  const auth = requireRndWorker(request.headers.get("authorization"));
  if (auth) return auth;

  const body = (await request.json().catch(() => null)) as { sourceUrl?: unknown; promptKey?: unknown; targetKey?: unknown } | null;
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const promptKey = typeof body?.promptKey === "string" ? body.promptKey.trim() : "";
  const suppliedTargetKey = typeof body?.targetKey === "string" ? body.targetKey.trim() : "";
  if (!sourceUrl || !promptKey || !suppliedTargetKey) {
    return NextResponse.json({ error: "sourceUrl, promptKey and targetKey are required" }, { status: 400 });
  }
  if (!suppliedTargetKey.startsWith(TEST_TARGET_PREFIX)) {
    return NextResponse.json({ error: "Regression targetKey must use the Task 3 fixture prefix" }, { status: 400 });
  }

  let parsed: URL;
  try { parsed = new URL(sourceUrl); } catch { return NextResponse.json({ error: "sourceUrl must be a valid URL" }, { status: 400 }); }
  if (parsed.protocol !== "https:" || !ALLOWED_SOURCE_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "Test source URL is not allowed" }, { status: 400 });
  }
  if (!STYLE_PROMPTS[promptKey]) return NextResponse.json({ error: "Unknown hairstyle prompt key" }, { status: 404 });

  // Do not follow redirects from an approved image host to an unapproved destination.
  const response = await fetch(parsed.toString(), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) return NextResponse.json({ error: "Test source image could not be fetched" }, { status: 502 });
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
    return NextResponse.json({ error: "Test source is not a supported image" }, { status: 415 });
  }
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: "Test source image size is outside the allowed range" }, { status: 413 });
  }
  if (!response.body) return NextResponse.json({ error: "Test source image has no body" }, { status: 502 });
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_SOURCE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return NextResponse.json({ error: "Test source image size is outside the allowed range" }, { status: 413 });
    }
    chunks.push(Buffer.from(value));
  }
  if (totalBytes === 0) return NextResponse.json({ error: "Test source image is empty" }, { status: 413 });
  const buffer = Buffer.concat(chunks);
  const metadata = await sharp(buffer).metadata().catch(() => null);
  if (!metadata || !["png", "jpeg", "webp"].includes(metadata.format || "") ||
      (metadata.format === "png" && mimeType !== "image/png") ||
      (metadata.format === "jpeg" && mimeType !== "image/jpeg") ||
      (metadata.format === "webp" && mimeType !== "image/webp")) {
    return NextResponse.json({ error: "Test source image content does not match its type" }, { status: 415 });
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  const storageKey = "rnd/sources/" + checksum + "-" + randomUUID() + "." + extension;
  const blob = await put(storageKey, buffer, { access: "private", addRandomSuffix: false, contentType: mimeType });
  const built = await buildRndPrompt({ promptKey });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const campaign = await tx.rnDCampaign.create({
        data: { name: "R&D Task 3 approval-fence regression fixture", status: "DRAFT", autoAdvanceEnabled: false, createdByUserId: "task3-regression-fixture" },
      });
      const source = await tx.rnDAsset.create({
        data: { kind: "SOURCE", storageKey, blobUrl: blob.url, originalFilename: parsed.pathname.split("/").pop() || "test-source", mimeType, fileSize: buffer.length, checksum, immutable: true },
      });
      const target = await tx.rnDTarget.create({
        data: { campaignId: campaign.id, targetType: "SINGLE", targetKey: suppliedTargetKey, hairstyleId: null, sourceAssetId: source.id, status: "HUMAN_APPROVAL" },
      });
      const job = await tx.rnDJob.create({
        data: { targetId: target.id, status: "HUMAN_APPROVAL", promptVersionNumber: 1, currentPrompt: built.prompt, queuedAt: new Date(), attemptCount: 1, completedAt: null },
      });
      await tx.rnDTarget.update({ where: { id: target.id }, data: { currentJobId: job.id } });
      const attempt = await tx.rnDAttempt.create({
        data: { jobId: job.id, attemptNumber: 1, prompt: built.prompt, promptRevision: "task3-approval-fence-fixture", submittedAt: new Date(), verdict: "HUMAN_APPROVAL", artifactId: source.id, overallScore: "9.50", aiGatePassed: true, publicationTierPassed: true, qaJson: { fixture: true, note: "Synthetic approval-fence fixture; not a generated production artifact." } },
      });
      return { campaignId: campaign.id, targetId: target.id, sourceAssetId: source.id, jobId: job.id, attemptId: attempt.id, storageKey };
    });
    return NextResponse.json({ ok: true, fixture: true, ...result });
  } catch (error) {
    const { del } = await import("@vercel/blob");
    await del(blob.url).catch(() => undefined);
    throw error;
  }
}
