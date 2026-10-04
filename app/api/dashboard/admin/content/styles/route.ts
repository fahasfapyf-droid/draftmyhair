import { NextResponse } from "next/server";
import { GenderTarget, HairstyleCategory, ServiceType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isSyncAuthorized(request: Request) {
  const expected = process.env.DMH_CATALOG_SYNC_KEY;
  return (
    process.env.VERCEL_ENV === "production" &&
    !!expected &&
    request.headers.get("x-dmh-catalog-sync-key") === expected
  );
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
  if (isSyncAuthorized(request)) {
    const body = await request.json().catch(() => null);
    const records = body && typeof body === "object" && Array.isArray(body.records) ? body.records : null;
    if (!records || records.length !== 147) {
      return NextResponse.json({ error: "Expected exactly 147 canonical catalog records." }, { status: 400 });
    }

    const names = records.map((r: any) => typeof r?.name === "string" ? r.name.trim() : "");
    const uniqueNames = new Set(names);
    if (names.some((n: string) => !n) || uniqueNames.size !== 147) {
      return NextResponse.json({ error: "Catalog names must be non-empty and unique." }, { status: 400 });
    }

    const normalized = records.map((r: any) => {
      const name = r.name.trim();
      const slug = typeof r.slug === "string" && r.slug.trim() ? slugify(r.slug) : slugify(name);
      const promptKey = typeof r.promptKey === "string" && r.promptKey.trim() ? slugify(r.promptKey) : slug;
      const serviceType = typeof r.serviceType === "string" && Object.values(ServiceType).includes(r.serviceType) ? r.serviceType as ServiceType : ServiceType.HAIRSTYLE;
      const category = typeof r.category === "string" && Object.values(HairstyleCategory).includes(r.category) ? r.category as HairstyleCategory : null;
      const gender = typeof r.gender === "string" && Object.values(GenderTarget).includes(r.gender) ? r.gender as GenderTarget : GenderTarget.UNISEX;
      const description = typeof r.description === "string" ? r.description.trim() || null : null;
      const thumbnailUrl = typeof r.thumbnailUrl === "string" ? r.thumbnailUrl.trim() || null : null;
      const displayOrder = Number.isFinite(r.displayOrder) ? Math.max(0, Number(r.displayOrder)) : 0;
      return { name, slug, promptKey, description, thumbnailUrl, serviceType, category, gender, displayOrder };
    });

    const existing = await prisma.hairstyle.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    const existingNames = new Set(existing.map((r: { name: string }) => r.name));
    const toCreate = normalized.filter((r) => !existingNames.has(r.name));

    const result = await prisma.$transaction(async (tx) => {
      if (toCreate.length) {
        await tx.hairstyle.createMany({ data: toCreate, skipDuplicates: true });
      }
      const after = await tx.hairstyle.findMany({
        where: { name: { in: names } },
        select: { id: true, name: true, slug: true, promptKey: true, serviceType: true, category: true, gender: true },
      });
      return after;
    });

    const finalNames = new Set(result.map((r: { name: string }) => r.name));
    const missing = names.filter((n) => !finalNames.has(n));
    return NextResponse.json({
      ok: missing.length === 0,
      expected: 147,
      existingBefore: existing.length,
      created: toCreate.length,
      totalAfter: result.length,
      missing,
    });
  }

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
