import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.galleryItem.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: { hairstyle: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const beforeUrl = typeof body.beforeUrl === "string" ? body.beforeUrl.trim() : "";
  const afterUrl = typeof body.afterUrl === "string" ? body.afterUrl.trim() : "";
  const hairstyleId = typeof body.hairstyleId === "string" && body.hairstyleId ? body.hairstyleId : null;

  if (!title || !category || !beforeUrl || !afterUrl) {
    return NextResponse.json({ error: "Title, category, before image and after image are required." }, { status: 400 });
  }

  const item = await prisma.galleryItem.create({
    data: {
      title,
      category,
      beforeUrl,
      afterUrl,
      hairstyleId,
      featured: body.featured === true,
      isPublished: body.isPublished === true,
      displayOrder: Number.isFinite(body.displayOrder) ? Math.max(0, Math.trunc(body.displayOrder)) : 0,
    },
    include: { hairstyle: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ item }, { status: 201 });
}
