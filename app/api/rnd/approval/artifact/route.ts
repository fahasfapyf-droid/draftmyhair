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
    select: { id: true, kind: true, blobUrl: true, mimeType: true, fileSize: true },
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

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "Blob storage is not configured" }, { status: 503 });

  const upstream = await fetch(artifact.blobUrl, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!upstream.ok) return NextResponse.json({ error: "Artifact could not be retrieved" }, { status: 502 });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": artifact.mimeType,
      "Content-Length": String(artifact.fileSize),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="rnd-${artifact.id}"`,
    },
  });
}
