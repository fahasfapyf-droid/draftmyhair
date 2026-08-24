import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [totalRequests, completedImages, failed, processing, completedByModel] =
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
        by: ["providerModel"],
        where: { status: "COMPLETED" },
        _count: { _all: true },
      }),
    ]);

  let pro = 0;
  let flash = 0;

  for (const row of completedByModel) {
    const model = row.providerModel.toLowerCase();
    const count = row._count._all;

    if (model.includes("flash")) {
      flash += count;
    } else if (model.includes("pro")) {
      pro += count;
    }
  }

  return NextResponse.json({
    totalRequests,
    completedImages,
    failed,
    processing,
    pro,
    flash,
  });
}
