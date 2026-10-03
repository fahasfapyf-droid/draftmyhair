import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import catalog from "@/lib/catalog-hairstyles.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.DMH_CATALOG_SYNC_SECRET;
  const provided = request.headers.get("x-dmh-catalog-sync-secret");
  return Boolean(expected && provided && provided === expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = [];

    for (const style of catalog) {
      const result = await prisma.hairstyle.upsert({
        where: { slug: style.slug },
        update: {
          name: style.name,
          serviceType: style.serviceType as any,
          category: style.category as any,
          description: style.description,
          thumbnailUrl: style.thumbnailUrl,
          promptKey: style.promptKey,
          gender: style.gender as any,
          displayOrder: style.displayOrder,
        },
        create: {
          slug: style.slug,
          name: style.name,
          serviceType: style.serviceType as any,
          category: style.category as any,
          description: style.description,
          thumbnailUrl: style.thumbnailUrl,
          promptKey: style.promptKey,
          gender: style.gender as any,
          displayOrder: style.displayOrder,
        },
      });
      results.push(result.slug);
    }

    const count = await prisma.hairstyle.count({
      where: { serviceType: "HAIRSTYLE" },
    });

    return NextResponse.json({
      ok: true,
      synced: results.length,
      hairstyleCount: count,
      source: "canonical production hairstyle catalog",
    });
  } catch (error) {
    console.error("Catalog sync failed:", error);
    return NextResponse.json({ error: "Catalog sync failed" }, { status: 500 });
  }
}
