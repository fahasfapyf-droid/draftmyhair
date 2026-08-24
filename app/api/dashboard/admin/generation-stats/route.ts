import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [total, completed, failed, processing, byModelAndStatus] =
    await Promise.all([
      prisma.generation.count(),
      prisma.generation.count({ where: { status: "COMPLETED" } }),
      prisma.generation.count({ where: { status: "FAILED" } }),
      prisma.generation.count({
        where: {
          status: { in: ["QUEUED", "PROCESSING"] },
        },
      }),
      prisma.generation.groupBy({
        by: ["providerModel", "status"],
        _count: { _all: true },
      }),
    ]);

  const models = {
    pro: { total: 0, completed: 0, failed: 0, processing: 0 },
    flash: { total: 0, completed: 0, failed: 0, processing: 0 },
  };

  for (const row of byModelAndStatus) {
    const model = row.providerModel.toLowerCase();
    const count = row._count._all;
    const bucket = model.includes("flash")
      ? models.flash
      : model.includes("pro")
        ? models.pro
        : null;

    if (!bucket) continue;

    bucket.total += count;

    if (row.status === "COMPLETED") {
      bucket.completed += count;
    } else if (row.status === "FAILED") {
      bucket.failed += count;
    } else if (row.status === "QUEUED" || row.status === "PROCESSING") {
      bucket.processing += count;
    }
  }

  return NextResponse.json({
    total,
    completed,
    failed,
    processing,
    models,
  });
}
