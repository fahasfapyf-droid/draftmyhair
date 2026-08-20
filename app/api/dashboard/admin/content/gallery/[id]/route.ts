import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.category === "string") data.category = body.category.trim();
  if (typeof body.beforeUrl === "string") data.beforeUrl = body.beforeUrl.trim();
  if (typeof body.afterUrl === "string") data.afterUrl = body.afterUrl.trim();
  if (typeof body.hairstyleId === "string") data.hairstyleId = body.hairstyleId || null;
  if (typeof body.featured === "boolean") data.featured = body.featured;
  if (typeof body.isPublished === "boolean") data.isPublished = body.isPublished;
  if (typeof body.displayOrder === "number") data.displayOrder = Math.max(0, Math.trunc(body.displayOrder));

  try {
    const item = await prisma.galleryItem.update({ where: { id }, data, include: { hairstyle: { select: { id: true, name: true } } } });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("Admin gallery update failed:", error);
    return NextResponse.json({ error: "Unable to update gallery item." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    await prisma.galleryItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin gallery delete failed:", error);
    return NextResponse.json({ error: "Unable to delete gallery item." }, { status: 400 });
  }
}
