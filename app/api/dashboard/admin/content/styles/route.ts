import { NextResponse } from "next/server";
import { GenderTarget, HairstyleCategory, ServiceType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() { const session = await auth(); return session?.user?.id && session.user.role === "ADMIN"; }

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const styles = await prisma.hairstyle.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { promptVersions: { where: { status: "ACTIVE" }, orderBy: { version: "desc" }, take: 1, select: { id: true, version: true, qaStatus: true, updatedAt: true } }, _count: { select: { galleryItems: true, generations: true } } },
  });
  return NextResponse.json({ styles }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const generatedKey = slugify(name);
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : generatedKey;
  const promptKey = typeof body.promptKey === "string" && body.promptKey.trim() ? slugify(body.promptKey) : generatedKey;
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() || null : null;
  const serviceType = typeof body.serviceType === "string" && Object.values(ServiceType).includes(body.serviceType) ? body.serviceType as ServiceType : ServiceType.HAIRSTYLE;
  const category = typeof body.category === "string" && Object.values(HairstyleCategory).includes(body.category) ? body.category as HairstyleCategory : null;
  const gender = typeof body.gender === "string" && Object.values(GenderTarget).includes(body.gender) ? body.gender as GenderTarget : GenderTarget.UNISEX;
  const displayOrder = Number.isFinite(body.displayOrder) ? Math.max(0, Number(body.displayOrder)) : 0;
  if (!name || !generatedKey) return NextResponse.json({ error: "A valid content name is required." }, { status: 400 });
  try {
    const style = await prisma.hairstyle.create({ data: { name, slug, promptKey, description, thumbnailUrl, serviceType, category, gender, displayOrder } });
    return NextResponse.json({ style }, { status: 201 });
  } catch (error) {
    console.error("Admin style create failed:", error);
    return NextResponse.json({ error: "Unable to create hairstyle." }, { status: 400 });
  }
}
