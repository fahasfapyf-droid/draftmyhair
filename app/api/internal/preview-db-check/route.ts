import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "chore/verify-preview-db-dmh"
  );
}

export async function GET() {
  if (!authorized()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [total, byServiceType] = await Promise.all([
    prisma.hairstyle.count(),
    prisma.hairstyle.groupBy({
      by: ["serviceType"],
      _count: { _all: true },
      orderBy: { serviceType: "asc" },
    }),
  ]);

  return NextResponse.json({
    environment: process.env.VERCEL_ENV,
    branch: process.env.VERCEL_GIT_COMMIT_REF,
    total,
    byServiceType: Object.fromEntries(
      byServiceType.map((row) => [row.serviceType, row._count._all])
    ),
  });
}
