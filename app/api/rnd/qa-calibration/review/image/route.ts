import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }

  const attemptId = new URL(request.url).searchParams.get("attemptId")?.trim();
  if (!attemptId) return new Response("Missing attemptId", { status: 400 });

  const attempt = await prisma.rnDAttempt.findUnique({
    where: { id: attemptId },
    select: {
      artifact: {
        select: {
          blobUrl: true,
          mimeType: true,
        },
      },
    },
  });

  if (!attempt?.artifact?.blobUrl) return new Response("Image not found", { status: 404 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return new Response("Blob storage is not configured", { status: 503 });

  const upstream = await fetch(attempt.artifact.blobUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Unable to load image", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": attempt.artifact.mimeType,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
