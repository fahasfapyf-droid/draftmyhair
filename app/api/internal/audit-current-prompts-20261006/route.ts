import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.hairstyle.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, slug: true, serviceType: true, promptKey: true,
      promptVersions: {
        orderBy: { version: "asc" },
        select: {
          id: true, version: true, status: true, qaStatus: true, prompt: true, notes: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const promptVersions = rows.flatMap(s => s.promptVersions.map(p => ({
    hairstyleId: s.id,
    hairstyle: s.name,
    slug: s.slug,
    serviceType: s.serviceType,
    promptKey: s.promptKey,
    promptVersionId: p.id,
    version: p.version,
    status: p.status,
    qaStatus: p.qaStatus,
    prompt: p.prompt,
    notes: p.notes,
  })));

  return NextResponse.json({
    temporary: true,
    readOnly: true,
    generatedAt: new Date().toISOString(),
    counts: {
      activeCatalogEntries: rows.length,
      promptVersionRecords: promptVersions.length,
      entriesWithPromptVersion: rows.filter(x => x.promptVersions.length).length,
    },
    promptVersions,
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }});
}