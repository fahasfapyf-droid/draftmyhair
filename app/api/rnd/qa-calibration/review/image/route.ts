import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "node:crypto";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";
import { lockActiveAdmin } from "@/lib/rnd/admin-auth";

export const runtime = "nodejs";
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });

  const reviewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isActive: true, isDeleted: true } });
  if (!reviewer || reviewer.role !== "ADMIN" || !reviewer.isActive || reviewer.isDeleted) return new Response("Unauthorized", { status: 401 });

  const attemptId = new URL(request.url).searchParams.get("attemptId")?.trim();
  if (!attemptId) return new Response("Missing attemptId", { status: 400 });

  const attempt = await prisma.rnDAttempt.findUnique({ where: { id: attemptId }, select: {
    id: true, prompt: true, artifact: { select: { blobUrl: true, mimeType: true, checksum: true, fileSize: true, kind: true } },
  } });
  if (!attempt?.artifact?.blobUrl || attempt.artifact.kind !== "GENERATED" || !/^[a-f0-9]{64}$/.test(attempt.artifact.checksum ?? "") || !attempt.prompt) {
    return new Response("Image not found", { status: 404 });
  }

  let token: string;
  try { token = requireRndBlobToken(); } catch { return new Response("R&D storage is not configured", { status: 503 }); }

  try {
    const upstream = await fetch(attempt.artifact.blobUrl, {
      redirect: "error", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok || !upstream.body) return new Response("Unable to load image", { status: 502 });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    const artifactChecksum = sha256(bytes);
    if (bytes.length !== attempt.artifact.fileSize || artifactChecksum !== attempt.artifact.checksum) return new Response("Review image integrity mismatch", { status: 502 });

    // The receipt proves this authenticated reviewer received the exact validated bytes.
    // It is short-lived, opaque, single-use, and stored only as a hash.
    const receiptToken = randomBytes(32).toString("base64url");
    const receipt = await prisma.$transaction(async tx => {
      if (!await lockActiveAdmin(tx, session.user.id)) return false;
      await tx.rnDQAReviewReceipt.create({ data: {
        tokenHash: sha256(receiptToken), attemptId: attempt.id, reviewerId: session.user.id,
        promptChecksum: sha256(attempt.prompt), artifactChecksum, expiresAt: new Date(Date.now() + 10 * 60_000),
      } });
      return true;
    });
    if (!receipt) return new Response("Unauthorized", { status: 401 });

    return new Response(bytes, { status: 200, headers: {
      "content-type": attempt.artifact.mimeType, "cache-control": "private, no-store",
      "x-content-type-options": "nosniff", "x-rnd-review-receipt": receiptToken,
    } });
  } catch {
    return new Response("Unable to load image", { status: 502 });
  }
}
