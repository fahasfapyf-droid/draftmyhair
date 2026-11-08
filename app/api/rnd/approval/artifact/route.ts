import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artifactId = new URL(request.url).searchParams.get("artifactId");
  if (!artifactId) return NextResponse.json({ error: "artifactId is required" }, { status: 400 });

  const artifact = await prisma.rnDAsset.findUnique({
    where: { id: artifactId },
    select: { id: true, kind: true, storageKey: true, mimeType: true, fileSize: true },
  });
  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

  // Real approval artifacts must remain GENERATED. The sole exception is the
  // explicitly marked Task 3 regression fixture, which previews its SOURCE
  // image so the approval UI can be exercised without running a worker.
  if (artifact.kind !== "GENERATED") {
    const fixtureAttempt = artifact.kind === "SOURCE"
      ? await prisma.rnDAttempt.findFirst({
          where: {
            artifactId,
            verdict: "HUMAN_APPROVAL",
            job: {
              target: {
                targetKey: { startsWith: "task3-approval-fence-fixture-" },
                campaign: {
                  name: "R&D Task 3 approval-fence regression fixture",
                  createdByUserId: "task3-regression-fixture",
                },
              },
            },
          },
          select: { qaJson: true },
        })
      : null;

    const qa = fixtureAttempt?.qaJson;
    const isTask3Fixture = Boolean(
      qa && typeof qa === "object" && !Array.isArray(qa) &&
      (qa as Record<string, unknown>).fixture === true,
    );
    if (!isTask3Fixture) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  // Private Vercel Blob objects must be read through the Blob SDK. Fetching
  // blobUrl directly with the storage token as a Bearer header is not the
  // private-blob retrieval contract and returns an upstream failure.
  try {
    const stored = await get(artifact.storageKey, { access: "private" });
    if (!stored) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

    return new Response(stored.stream, {
      status: 200,
      headers: {
        "Content-Type": stored.blob.contentType ?? artifact.mimeType,
        "Content-Length": String(stored.blob.size ?? artifact.fileSize),
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="rnd-${artifact.id}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[rnd-approval-artifact] private Blob retrieval failed", {
      artifactId: artifact.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Artifact could not be retrieved" }, { status: 502 });
  }
}
