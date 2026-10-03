import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import catalog from "@/lib/catalog-hairstyles.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "chore/optimize-hairstyles-61-65"
  );
}

export async function POST() {
  if (!authorized()) {
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
