import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const [styles, prompts, gallery] = await Promise.all([
    prisma.hairstyle.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
    prisma.stylePrompt.findMany({ include: { hairstyle: { select: { id: true, name: true, promptKey: true } } }, orderBy: [{ updatedAt: "desc" }] }),
    prisma.galleryItem.findMany({ include: { hairstyle: { select: { id: true, name: true } } }, orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }] }),
  ]);
  return NextResponse.json({ styles, prompts, gallery });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const body = await request.json();

  if (body.type === "migrate-prompts") {
    const styles = await prisma.hairstyle.findMany({ where: { promptKey: { in: Object.keys(STYLE_PROMPTS) } }, select: { id: true, promptKey: true } });
    let created = 0;
    let skipped = 0;
    let unmatched = 0;
    for (const style of styles) {
      const sourcePrompt = STYLE_PROMPTS[style.promptKey];
      if (!sourcePrompt) { unmatched += 1; continue; }
      const existing = await prisma.stylePrompt.findFirst({ where: { hairstyleId: style.id }, select: { id: true } });
      if (existing) { skipped += 1; continue; }
      await prisma.stylePrompt.create({ data: { hairstyleId: style.id, version: "v1", prompt: sourcePrompt.prompt, notes: "Migrated from the compiled production prompt library; prompt text preserved verbatim.", qaStatus: "QA_PASSED", isActive: true } });
      created += 1;
    }
    return NextResponse.json({ ok: true, created, skipped, unmatched });
  }

  if (body.type === "style") {
    if (!body.name || !body.slug || !body.promptKey || !body.gender) return NextResponse.json({ error: "name, slug, promptKey and gender are required" }, { status: 400 });
    const style = await prisma.hairstyle.create({ data: { name: String(body.name).trim(), slug: String(body.slug).trim().toLowerCase(), promptKey: String(body.promptKey).trim(), gender: body.gender, serviceType: body.serviceType ?? "HAIRSTYLE", category: body.category ?? null, description: body.description ? String(body.description).trim() : null, thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl).trim() : null, displayOrder: Number(body.displayOrder ?? 0), isActive: body.isActive !== false } });
    return NextResponse.json(style, { status: 201 });
  }

  if (body.type === "prompt") {
    if (!body.hairstyleId || !body.version || !body.prompt) return NextResponse.json({ error: "hairstyleId, version and prompt are required" }, { status: 400 });
    const prompt = await prisma.$transaction(async (tx) => {
      if (body.isActive) await tx.stylePrompt.updateMany({ where: { hairstyleId: body.hairstyleId }, data: { isActive: false } });
      return tx.stylePrompt.create({ data: { hairstyleId: body.hairstyleId, version: String(body.version).trim(), prompt: String(body.prompt), notes: body.notes ? String(body.notes) : null, qaStatus: body.qaStatus ?? "DRAFT", isActive: Boolean(body.isActive) } });
    });
    return NextResponse.json(prompt, { status: 201 });
  }

  if (body.type === "gallery") {
    if (!body.hairstyleId || !body.title || !body.beforeUrl || !body.afterUrl) return NextResponse.json({ error: "hairstyleId, title, beforeUrl and afterUrl are required" }, { status: 400 });
    const item = await prisma.galleryItem.create({ data: { hairstyleId: body.hairstyleId, title: String(body.title).trim(), category: body.category ? String(body.category).trim() : null, beforeUrl: String(body.beforeUrl).trim(), afterUrl: String(body.afterUrl).trim(), caption: body.caption ? String(body.caption).trim() : null, displayOrder: Number(body.displayOrder ?? 0), featured: Boolean(body.featured), isPublished: Boolean(body.isPublished) } });
    return NextResponse.json(item, { status: 201 });
  }
  return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const body = await request.json();
  if (!body.id || !body.type) return NextResponse.json({ error: "id and type are required" }, { status: 400 });
  if (body.type === "style") {
    const style = await prisma.hairstyle.update({ where: { id: body.id }, data: { ...(body.name !== undefined && { name: String(body.name).trim() }), ...(body.slug !== undefined && { slug: String(body.slug).trim().toLowerCase() }), ...(body.promptKey !== undefined && { promptKey: String(body.promptKey).trim() }), ...(body.gender !== undefined && { gender: body.gender }), ...(body.serviceType !== undefined && { serviceType: body.serviceType }), ...(body.category !== undefined && { category: body.category || null }), ...(body.description !== undefined && { description: body.description || null }), ...(body.thumbnailUrl !== undefined && { thumbnailUrl: body.thumbnailUrl || null }), ...(body.displayOrder !== undefined && { displayOrder: Number(body.displayOrder) }), ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }) } });
    return NextResponse.json(style);
  }
  if (body.type === "prompt") {
    const prompt = await prisma.$transaction(async (tx) => {
      if (body.isActive) {
        const current = await tx.stylePrompt.findUnique({ where: { id: body.id }, select: { hairstyleId: true } });
        if (current) await tx.stylePrompt.updateMany({ where: { hairstyleId: current.hairstyleId }, data: { isActive: false } });
      }
      return tx.stylePrompt.update({ where: { id: body.id }, data: { ...(body.version !== undefined && { version: String(body.version).trim() }), ...(body.prompt !== undefined && { prompt: String(body.prompt) }), ...(body.notes !== undefined && { notes: body.notes || null }), ...(body.qaStatus !== undefined && { qaStatus: body.qaStatus }), ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }) } });
    });
    return NextResponse.json(prompt);
  }
  if (body.type === "gallery") {
    const item = await prisma.galleryItem.update({ where: { id: body.id }, data: { ...(body.hairstyleId !== undefined && { hairstyleId: body.hairstyleId }), ...(body.title !== undefined && { title: String(body.title).trim() }), ...(body.category !== undefined && { category: body.category || null }), ...(body.beforeUrl !== undefined && { beforeUrl: String(body.beforeUrl).trim() }), ...(body.afterUrl !== undefined && { afterUrl: String(body.afterUrl).trim() }), ...(body.caption !== undefined && { caption: body.caption || null }), ...(body.displayOrder !== undefined && { displayOrder: Number(body.displayOrder) }), ...(body.featured !== undefined && { featured: Boolean(body.featured) }), ...(body.isPublished !== undefined && { isPublished: Boolean(body.isPublished) }) } });
    return NextResponse.json(item);
  }
  return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const body = await request.json();
  if (!body.id || !body.type) return NextResponse.json({ error: "id and type are required" }, { status: 400 });
  if (body.type === "gallery") { await prisma.galleryItem.delete({ where: { id: body.id } }); return NextResponse.json({ ok: true }); }
  if (body.type === "prompt") { await prisma.stylePrompt.delete({ where: { id: body.id } }); return NextResponse.json({ ok: true }); }
  if (body.type === "style") { await prisma.hairstyle.update({ where: { id: body.id }, data: { isActive: false } }); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
}
