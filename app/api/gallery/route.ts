import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueSignedToken } from "@vercel/blob";
import { toGalleryMediaUrl } from "@/lib/storage/galleryMediaUrl";

export async function GET() {
  const items = await prisma.galleryItem.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, category: true, beforeUrl: true, afterUrl: true, featured: true },
  });

  const delegationToken = (
    await issueSignedToken({
      pathname: "content/gallery/*",
      operations: ["get"],
      validUntil: Date.now() + 60 * 60 * 1000,
    })
  ).delegationToken;

  const galleryItems = await Promise.all(
    items.map(async (item) => ({
      ...item,
      beforeUrl: await toGalleryMediaUrl(item.beforeUrl, delegationToken),
      afterUrl: await toGalleryMediaUrl(item.afterUrl, delegationToken),
    })),
  );

  return NextResponse.json(
    { items: galleryItems },
    { headers: { "Cache-Control": "no-store" } },
  );
}
