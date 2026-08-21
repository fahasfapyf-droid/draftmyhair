import { NextResponse } from "next/server";
import { GenderTarget, HairstyleCategory, ServiceType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() { const session = await auth(); return session?.user?.id && session.user.role === "ADMIN"; }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.slug === "string") data.slug = body.slug.trim().toLowerCase();
  if (typeof body.promptKey === "string") data.promptKey = body.promptKey.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.thumbnailUrl === "string") data.thumbnailUrl = body.thumbnailUrl.trim() || null;
  if (body.thumbnailUrl === null) data.thumbnailUrl = null;
  if (typeof body.serviceType === "string" && Object.values(ServiceType).includes(body.serviceType)) data.serviceType = body.serviceType as ServiceType;
  if (typeof body.category === "string") data.category = Object.values(HairstyleCategory).includes(body.category) ? body.category as HairstyleCategory : null;
  if (body.category === null) data.category = null;
  if (typeof body.gender === "string" && Object.values(GenderTarget).includes(body.gender)) data.gender = body.gender as GenderTarget;
  if (typeof body.displayOrder === "number") data.displayOrder = Math.max(0, Math.trunc(body.displayOrder));
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  try {
    const style = await prisma.hairstyle.update({ where: { id }, data });
    return NextResponse.json({ style });
  } catch (error) {
    console.error("Admin style update failed:", error);
    return NextResponse.json({ error: "Unable to update hairstyle." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const style = await prisma.hairstyle.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { generations: true, feedbacks: true } } },
    });
    if (!style) return NextResponse.json({ error: "Content item not found." }, { status: 404 });

    if (style._count.generations > 0 || style._count.feedbacks > 0) {
      return NextResponse.json({
        error: `${style.name} has customer history and cannot be permanently deleted. Deactivate it instead.`,
      }, { status: 409 });
    }

    await prisma.hairstyle.delete({ where: { id } });
    return NextResponse.json({ deleted: true, name: style.name });
  } catch (error) {
    console.error("Admin style delete failed:", error);
    return NextResponse.json({ error: "Unable to delete content item." }, { status: 400 });
  }
}
