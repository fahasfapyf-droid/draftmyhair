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
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.slug === "string") data.slug = body.slug.trim().toLowerCase();
  if (typeof body.promptKey === "string") data.promptKey = body.promptKey.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.thumbnailUrl === "string") data.thumbnailUrl = body.thumbnailUrl.trim() || null;
  if (typeof body.serviceType === "string") data.serviceType = body.serviceType;
  if (typeof body.category === "string") data.category = body.category || null;
  if (typeof body.gender === "string") data.gender = body.gender;
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
