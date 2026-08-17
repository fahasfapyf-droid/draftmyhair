import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return false;
  return true;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const styles = await prisma.hairstyle.findMany({
    where: { promptKey: { in: Object.keys(STYLE_PROMPTS) } },
    select: { id: true, name: true, promptKey: true },
  });

  let created = 0;
  let skipped = 0;

  for (const style of styles) {
    const sourcePrompt = STYLE_PROMPTS[style.promptKey];
    if (!sourcePrompt) continue;

    const existing = await prisma.stylePrompt.findFirst({
      where: { hairstyleId: style.id },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.stylePrompt.create({
      data: {
        hairstyleId: style.id,
        version: "v1",
        prompt: sourcePrompt.prompt,
        notes: "Migrated from the compiled production prompt library; prompt text preserved verbatim.",
        qaStatus: "QA_PASSED",
        isActive: true,
      },
    });

    created += 1;
  }

  return NextResponse.json({
    ok: true,
    message: "Existing production hairstyle prompts imported.",
    created,
    skipped,
    sourcePromptCount: Object.keys(STYLE_PROMPTS).length,
  });
}

export async function POST() {
  return GET();
}
