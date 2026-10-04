import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expectedBranch = "audit/reconcile-promptversions-67";
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== expectedBranch) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const rows = await prisma.promptVersion.findMany({
    orderBy: [{ hairstyle: { name: "asc" } }, { version: "asc" }],
    select: {
      id: true, version: true, status: true, qaStatus: true,
      createdAt: true, updatedAt: true,
      hairstyle: { select: { id: true, name: true, serviceType: true, isActive: true, promptKey: true } },
    },
  });

  const byStyle = new Map<string, any[]>();
  for (const row of rows) {
    const name = row.hairstyle.name;
    if (!byStyle.has(name)) byStyle.set(name, []);
    byStyle.get(name)!.push(row);
  }

  return NextResponse.json({
    totalPromptVersions: rows.length,
    uniqueHairstylesWithPromptVersions: byStyle.size,
    activeHairstylesWithPromptVersions: new Set(rows.filter(r => r.hairstyle.isActive).map(r => r.hairstyle.id)).size,
    serviceBreakdown: Object.fromEntries(
      [...new Set(rows.map(r => r.hairstyle.serviceType))].map(s => [s, rows.filter(r => r.hairstyle.serviceType === s).length])
    ),
    rows,
  }, { headers: { "Cache-Control": "no-store" } });
}
