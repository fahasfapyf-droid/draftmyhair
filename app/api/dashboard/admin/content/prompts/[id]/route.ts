import { NextResponse } from "next/server";
import { PromptQAStatus, PromptStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";
import { lockPromptStyle, verifiedPromptCandidate } from "@/lib/rnd/promotion-provenance";
import { lockActiveAdmin } from "@/lib/rnd/admin-auth";
import { lockCalibration } from "@/lib/rnd/calibration-evidence";

async function requireAdmin() { const session = await auth(); return session?.user?.id && session.user.role === "ADMIN" ? session.user.id : null; }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const status = typeof body.status === "string" && Object.values(PromptStatus).includes(body.status) ? body.status as PromptStatus : undefined;
  const qaStatus = typeof body.qaStatus === "string" && Object.values(PromptQAStatus).includes(body.qaStatus) ? body.qaStatus as PromptQAStatus : undefined;
  if (qaStatus === PromptQAStatus.PASSED) return NextResponse.json({ code: "RND_CALIBRATION_OUTCOME_READ_ONLY" }, { status: 409 });
  if (id.startsWith("compiled:") && status === PromptStatus.ACTIVE) return NextResponse.json({ code: "RND_PROMOTION_PROVENANCE_REQUIRED" }, { status: 409 });

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
        if (!await lockPromptStyle(tx, hairstyleId)) throw new Error("PROMPT_STYLE_MISSING");
        await lockCalibration(tx);
        if (!await lockActiveAdmin(tx, adminId)) return { code: "PROMPT_ADMIN_REQUIRED" };
        const latest = await tx.promptVersion.findFirst({ where: { hairstyleId }, orderBy: { version: "desc" }, select: { version: true } });
        const version = (latest?.version ?? 0) + 1;
        const nextStatus = PromptStatus.DRAFT;
        return tx.promptVersion.create({
          data: {
            hairstyleId,
            version,
            prompt: typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : compiled.prompt,
            notes: typeof body.notes === "string" ? body.notes.trim() || null : "Imported from compiled production prompt.",
            qaStatus: qaStatus ?? PromptQAStatus.DRAFT,
            status: nextStatus,
          },
          include: { hairstyle: { select: { id: true, name: true, promptKey: true } } },
        });
      });
      if ("code" in result) return NextResponse.json({ code: result.code }, { status: result.code === "PROMPT_ADMIN_REQUIRED" ? 401 : 404 });
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
      if (!await lockPromptStyle(tx, existing.hairstyleId)) return { code: "PROMPT_STYLE_MISSING" };
      await lockCalibration(tx);
      if (!await lockActiveAdmin(tx, adminId)) return { code: "PROMPT_ADMIN_REQUIRED" };
      const candidate = await tx.promptVersion.findUnique({ where: { id } });
      if (!candidate) return { code: "PROMPT_VERSION_MISSING" };
      const edited = typeof body.prompt === "string" && body.prompt.trim() !== candidate.prompt;
      if (candidate.sourceRnDAttemptId && edited) return { code: "RND_APPROVED_PROMPT_IMMUTABLE" };
      const affectsActive = status === PromptStatus.ACTIVE || (candidate.status === PromptStatus.ACTIVE && status !== PromptStatus.DRAFT && status !== PromptStatus.ARCHIVED && (edited || qaStatus !== undefined));
      if (affectsActive && (edited || qaStatus !== undefined || !await verifiedPromptCandidate(tx, candidate))) return { code: "RND_PROMOTION_PROVENANCE_REQUIRED" };
      if (status === PromptStatus.ACTIVE) await tx.promptVersion.updateMany({ where: { hairstyleId: existing.hairstyleId, status: PromptStatus.ACTIVE, id: { not: id } }, data: { status: PromptStatus.ARCHIVED } });
      const data: Record<string, unknown> = {};
      if (typeof body.prompt === "string") data.prompt = body.prompt.trim();
      if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
      if (qaStatus) data.qaStatus = qaStatus;
      if (status) data.status = status;
      return tx.promptVersion.update({ where: { id }, data, include: { hairstyle: { select: { id: true, name: true, promptKey: true } } } });
    });
    if ("code" in result) return NextResponse.json(result, { status: result.code === "PROMPT_ADMIN_REQUIRED" ? 401 : 409 });
    return NextResponse.json({ prompt: result });
  } catch (error) {
    console.error("Admin prompt update failed:", error);
    return NextResponse.json({ error: "Unable to update prompt version." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (id.startsWith("compiled:")) return NextResponse.json({ error: "Compiled production prompts cannot be deleted. Create a database version first if you need to retire or replace it." }, { status: 409 });

  try {
    const existing = await prisma.promptVersion.findUnique({ where: { id }, select: { hairstyleId: true } });
    if (!existing) return NextResponse.json({ error: "Prompt version not found." }, { status: 404 });
    const result = await prisma.$transaction(async tx => {
      if (!await lockPromptStyle(tx, existing.hairstyleId)) return { code: "PROMPT_STYLE_MISSING" as const };
      await lockCalibration(tx);
      if (!await lockActiveAdmin(tx, adminId)) return { code: "PROMPT_ADMIN_REQUIRED" as const };
      const prompt = await tx.promptVersion.findUnique({ where: { id }, select: { id: true, hairstyle: { select: { name: true } } } });
      if (!prompt) return { code: "PROMPT_VERSION_MISSING" as const };
      await tx.promptVersion.delete({ where: { id } });
      return { code: "OK" as const, name: prompt.hairstyle.name };
    });
    if (result.code !== "OK") return NextResponse.json({ code: result.code }, { status: result.code === "PROMPT_ADMIN_REQUIRED" ? 401 : 404 });
    return NextResponse.json({ deleted: true, name: result.name });
  } catch (error) {
    console.error("Admin prompt delete failed:", error);
    return NextResponse.json({ error: "Unable to delete prompt version." }, { status: 400 });
  }
}
