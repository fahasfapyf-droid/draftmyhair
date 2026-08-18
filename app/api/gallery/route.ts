import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toGalleryMediaUrl } from "@/lib/storage/galleryMediaUrl";

export async function GET() {
  const items = await prisma.galleryItem.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, category: true, beforeUrl: true, afterUrl: true, featured: true },
  });

  return NextResponse.json(
    {
      items: items.map((item) => ({
        ...item,
        beforeUrl: toGalleryMediaUrl(item.beforeUrl),
        afterUrl: toGalleryMediaUrl(item.afterUrl),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
