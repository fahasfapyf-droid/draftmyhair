import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

type StatusBody = {
  workerVersion?: unknown; protocolVersion?: unknown; workerState?: unknown;
  activeProfileId?: unknown; activeProfileLabel?: unknown; currentJobId?: unknown;
  captureStatus?: unknown; captureLastSuccessAt?: unknown; captureLastError?: unknown;
  profileSnapshot?: unknown;
};
function stringOrNull(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function dateOrNull(value: unknown) { if (typeof value !== "string") return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;
  const workerId = stringOrNull(request.headers.get("x-rnd-worker-id"));
  if (!workerId) return NextResponse.json({ error: "x-rnd-worker-id is required" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as StatusBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const now = new Date();
  const row = await prisma.rnDWorkerStatus.upsert({
    where: { workerId },
    create: {
      workerId, workerVersion: stringOrNull(body.workerVersion), protocolVersion: stringOrNull(body.protocolVersion),
      workerState: stringOrNull(body.workerState) ?? "ONLINE", activeProfileId: stringOrNull(body.activeProfileId),
      activeProfileLabel: stringOrNull(body.activeProfileLabel), currentJobId: stringOrNull(body.currentJobId),
      captureStatus: stringOrNull(body.captureStatus) ?? "UNKNOWN", captureLastSuccessAt: dateOrNull(body.captureLastSuccessAt),
      captureLastError: stringOrNull(body.captureLastError), profileSnapshot: body.profileSnapshot ?? null, lastHeartbeatAt: now,
    },
    update: {
      workerVersion: stringOrNull(body.workerVersion), protocolVersion: stringOrNull(body.protocolVersion),
      workerState: stringOrNull(body.workerState) ?? "ONLINE", activeProfileId: stringOrNull(body.activeProfileId),
      activeProfileLabel: stringOrNull(body.activeProfileLabel), currentJobId: stringOrNull(body.currentJobId),
      captureStatus: stringOrNull(body.captureStatus) ?? "UNKNOWN", captureLastSuccessAt: dateOrNull(body.captureLastSuccessAt),
      captureLastError: stringOrNull(body.captureLastError), profileSnapshot: body.profileSnapshot ?? null, lastHeartbeatAt: now,
    },
  });
  return NextResponse.json({ ok: true, workerId: row.workerId, lastHeartbeatAt: row.lastHeartbeatAt.toISOString() });
}
