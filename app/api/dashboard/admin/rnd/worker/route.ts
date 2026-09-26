import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ONLINE_WINDOW_MS = 90_000;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workers = await prisma.rnDWorkerStatus.findMany({
    orderBy: { lastHeartbeatAt: "desc" },
    take: 10,
    select: {
      workerId: true,
      workerVersion: true,
      protocolVersion: true,
      workerState: true,
      activeProfileId: true,
      activeProfileLabel: true,
      currentJobId: true,
      captureStatus: true,
      captureLastSuccessAt: true,
      captureLastError: true,
      profileSnapshot: true,
      lastHeartbeatAt: true,
      updatedAt: true,
    },
  });

  const now = Date.now();

  return NextResponse.json({
    workers: workers.map((worker) => ({
      ...worker,
      online: now - worker.lastHeartbeatAt.getTime() <= ONLINE_WINDOW_MS,
      lastHeartbeatAt: worker.lastHeartbeatAt.toISOString(),
      captureLastSuccessAt: worker.captureLastSuccessAt?.toISOString() ?? null,
      updatedAt: worker.updatedAt.toISOString(),
    })),
  });
}
