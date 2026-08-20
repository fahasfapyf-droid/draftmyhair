import { NextResponse } from "next/server";
import { PromptQAStatus, PromptStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

async function requireAdmin() { const session = await auth(); return session?.user?.id && session.user.role === "ADMIN"; }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const status = typeof body.status === "string" && Object.values(PromptStatus).includes(body.status) ? body.status as PromptStatus : undefined;
  const qaStatus = typeof body.qaStatus === "string" && Object.values(PromptQAStatus).includes(body.qaStatus) ? body.qaStatus as PromptQAStatus : undefined;

  // A compiled prompt is the existing production source when no database
  // override is active. Editing it from the admin UI creates a real database
  // version; the compiled source file and generation fallback remain untouched.
  if (id.startsWith("compiled:")) {
    const hairstyleId = id.slice("compiled:".length);
    const style = await prisma.hairstyle.findUnique({ where: { id: hairstyleId }, select: { id: true, name: true, promptKey: true } });
    if (!style) return NextResponse.json({ error: "Hairstyle not found." }, { status: 404 });
    const compiled = STYLE_PROMPTS[style.promptKey];
    if (!compiled) return NextResponse.json({ error: "Compiled prompt not found." }, { status: 404 });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const latest = await tx.promptVersion.findFirst({ where: { hairstyleId }, orderBy: { version: "desc" }, select: { version: true } });
        const version = (latest?.version ?? 0) + 1;
        const nextStatus = status === PromptStatus.ACTIVE ? PromptStatus.ACTIVE : PromptStatus.DRAFT;
        if (nextStatus === PromptStatus.ACTIVE) await tx.promptVersion.updateMany({ where: { hairstyleId, status: PromptStatus.ACTIVE }, data: { status: PromptStatus.ARCHIVED } });
        return tx.promptVersion.create({
          data: {
            hairstyleId,
            version,
            prompt: typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : compiled.prompt,
            notes: typeof body.notes === "string" ? body.notes.trim() || null : "Imported from compiled production prompt.",
            qaStatus: qaStatus ?? PromptQAStatus.PASSED,
            status: nextStatus,
          },
          include: { hairstyle: { select: { id: true, name: true, promptKey: true } } },
        });
      });
      return NextResponse.json({ prompt: result }, { status: 201 });
    } catch (error) {
      console.error("Admin compiled prompt import failed:", error);
      return NextResponse.json({ error: "Unable to create database prompt version." }, { status: 400 });
    }
  }

  const existing = await prisma.promptVersion.findUnique({ where: { id }, select: { hairstyleId: true } });
  if (!existing) return NextResponse.json({ error: "Prompt version not found." }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (status === PromptStatus.ACTIVE) await tx.promptVersion.updateMany({ where: { hairstyleId: existing.hairstyleId, status: PromptStatus.ACTIVE, id: { not: id } }, data: { status: PromptStatus.ARCHIVED } });
      const data: Record<string, unknown> = {};
      if (typeof body.prompt === "string") data.prompt = body.prompt.trim();
      if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
      if (qaStatus) data.qaStatus = qaStatus;
      if (status) data.status = status;
      return tx.promptVersion.update({ where: { id }, data, include: { hairstyle: { select: { id: true, name: true, promptKey: true } } } });
    });
    return NextResponse.json({ prompt: result });
  } catch (error) {
    console.error("Admin prompt update failed:", error);
    return NextResponse.json({ error: "Unable to update prompt version." }, { status: 400 });
  }
}
