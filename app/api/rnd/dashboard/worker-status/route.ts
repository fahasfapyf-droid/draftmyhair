import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workers = await prisma.rnDWorkerStatus.findMany({ orderBy: { lastHeartbeatAt: "desc" } });
  const now = Date.now();
  return NextResponse.json({
    workers: workers.map((worker) => ({ ...worker, online: now - worker.lastHeartbeatAt.getTime() <= 90_000 })),
  }, { headers: { "Cache-Control": "no-store" } });
}
