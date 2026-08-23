import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const PRO_MODEL = "gemini-3-pro-image";
const FLASH_MODEL = "gemini-3.1-flash-image";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [total, completed, failed, processing, modelStatusCounts] =
    await Promise.all([
      prisma.generation.count(),
      prisma.generation.count({ where: { status: "COMPLETED" } }),
      prisma.generation.count({ where: { status: "FAILED" } }),
      prisma.generation.count({ where: { status: "PROCESSING" } }),
      prisma.generation.groupBy({
        by: ["providerModel", "status"],
        _count: { _all: true },
        where: {
          providerModel: { in: [PRO_MODEL, FLASH_MODEL] },
        },
      }),
    ]);

  const getModelStats = (model: string) => {
    const rows = modelStatusCounts.filter((row) => row.providerModel === model);
    const count = (status: string) =>
      rows.find((row) => row.status === status)?._count._all ?? 0;

    return {
      total: rows.reduce((sum, row) => sum + row._count._all, 0),
      completed: count("COMPLETED"),
      failed: count("FAILED"),
      processing: count("PROCESSING"),
    };
  };

  return NextResponse.json({
    total,
    completed,
    failed,
    processing,
    models: {
      pro: getModelStats(PRO_MODEL),
      flash: getModelStats(FLASH_MODEL),
    },
  });
}
