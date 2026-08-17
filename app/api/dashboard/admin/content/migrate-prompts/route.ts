import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

const MIGRATED_NOTE =
  "Migrated from the compiled production prompt library; prompt text preserved verbatim.";

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
        notes: MIGRATED_NOTE,
        qaStatus: "QA_PASSED",
        // Imported prompts must never become production-active automatically.
        isActive: false,
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

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty POST retains the original import behavior.
  }

  if (body.action === "deactivate-imported") {
    const result = await prisma.stylePrompt.updateMany({
      where: {
        notes: MIGRATED_NOTE,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Imported production prompts were set inactive.",
      updated: result.count,
    });
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
        notes: MIGRATED_NOTE,
        qaStatus: "QA_PASSED",
        isActive: false,
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
