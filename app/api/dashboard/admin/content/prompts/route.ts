import { NextResponse } from "next/server";
import { PromptQAStatus, PromptStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

async function requireAdmin() { const session = await auth(); return session?.user?.id && session.user.role === "ADMIN"; }

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [prompts, styles] = await Promise.all([
    prisma.promptVersion.findMany({
      orderBy: [{ hairstyle: { name: "asc" } }, { version: "desc" }],
      include: { hairstyle: { select: { id: true, name: true, promptKey: true } } },
    }),
    prisma.hairstyle.findMany({
      select: { id: true, name: true, promptKey: true, promptVersions: { where: { status: PromptStatus.ACTIVE }, select: { id: true } } },
    }),
  ]);

  // The production engine already has compiled style prompts in source control.
  // Expose those prompts in the admin UI when a hairstyle has no active database
  // override, without changing the generation fallback or creating database rows.
  const compiledPrompts = styles.flatMap((style) => {
    if (style.promptVersions.length > 0) return [];
    const compiled = STYLE_PROMPTS[style.promptKey];
    if (!compiled) return [];
    return [{
      id: `compiled:${style.id}`,
      hairstyleId: style.id,
      version: 0,
      prompt: compiled.prompt,
      status: "COMPILED",
      qaStatus: "PASSED",
      notes: "Compiled production prompt from the source style library. Editing or activating it creates a database prompt version without changing the compiled source file.",
      hairstyle: { id: style.id, name: style.name, promptKey: style.promptKey },
    }];
  });

  return NextResponse.json({ prompts: [...prompts, ...compiledPrompts] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const hairstyleId = typeof body.hairstyleId === "string" ? body.hairstyleId : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const qaStatus = typeof body.qaStatus === "string" && Object.values(PromptQAStatus).includes(body.qaStatus) ? body.qaStatus as PromptQAStatus : PromptQAStatus.DRAFT;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const status = body.status === PromptStatus.ACTIVE ? PromptStatus.ACTIVE : PromptStatus.DRAFT;
  if (!hairstyleId || !prompt) return NextResponse.json({ error: "Hairstyle and prompt are required." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.promptVersion.findFirst({ where: { hairstyleId }, orderBy: { version: "desc" }, select: { version: true } });
      const version = (latest?.version ?? 0) + 1;
      if (status === PromptStatus.ACTIVE) await tx.promptVersion.updateMany({ where: { hairstyleId, status: PromptStatus.ACTIVE }, data: { status: PromptStatus.ARCHIVED } });
      return tx.promptVersion.create({ data: { hairstyleId, version, prompt, qaStatus, notes, status }, include: { hairstyle: { select: { id: true, name: true, promptKey: true } } } });
    });
    return NextResponse.json({ prompt: result }, { status: 201 });
  } catch (error) {
    console.error("Admin prompt create failed:", error);
    return NextResponse.json({ error: "Unable to create prompt version." }, { status: 400 });
  }
}
