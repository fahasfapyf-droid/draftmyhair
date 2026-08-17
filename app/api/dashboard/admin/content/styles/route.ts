import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const styles = await prisma.hairstyle.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      promptVersions: {
        where: { status: "ACTIVE" },
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, version: true, qaStatus: true, updatedAt: true },
      },
      _count: { select: { galleryItems: true, generations: true } },
    },
  });

  return NextResponse.json({ styles }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const promptKey = typeof body.promptKey === "string" ? body.promptKey.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() || null : null;
  const serviceType = typeof body.serviceType === "string" ? body.serviceType : "HAIRSTYLE";
  const category = typeof body.category === "string" && body.category ? body.category : null;
  const gender = typeof body.gender === "string" ? body.gender : "UNISEX";
  const displayOrder = Number.isFinite(body.displayOrder) ? Math.max(0, Number(body.displayOrder)) : 0;

  if (!name || !slug || !promptKey) {
    return NextResponse.json({ error: "Name, slug and prompt key are required." }, { status: 400 });
  }

  try {
    const style = await prisma.hairstyle.create({
      data: {
        name,
        slug,
        promptKey,
        description,
        thumbnailUrl,
        serviceType,
        category,
        gender,
        displayOrder,
      },
    });
    return NextResponse.json({ style }, { status: 201 });
  } catch (error) {
    console.error("Admin style create failed:", error);
    return NextResponse.json({ error: "Unable to create hairstyle." }, { status: 400 });
  }
}
