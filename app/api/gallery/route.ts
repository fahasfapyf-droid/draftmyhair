import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.galleryItem.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, category: true, beforeUrl: true, afterUrl: true, featured: true },
  });

  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
