import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toGalleryMediaUrl } from "@/lib/storage/galleryMediaUrl";

export async function GET() {
  const items = await prisma.galleryItem.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, category: true, beforeUrl: true, afterUrl: true, featured: true },
  });

  const galleryItems = await Promise.all(
    items.map(async (item) => ({
      ...item,
      beforeUrl: await toGalleryMediaUrl(item.beforeUrl),
      afterUrl: await toGalleryMediaUrl(item.afterUrl),
    })),
  );

  return NextResponse.json(
    { items: galleryItems },
    { headers: { "Cache-Control": "no-store" } },
  );
}
