import { NextResponse } from "next/server";
import { PromptStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "audit/hairstyles-without-prompts") {
    return NextResponse.json({ error: "Preview audit route only." }, { status: 404 });
  }

  const styles = await prisma.hairstyle.findMany({
    where: { serviceType: "HAIRSTYLE", isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      promptKey: true,
      promptVersions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, status: true, qaStatus: true },
      },
    },
  });

  const audit = styles.map((style) => {
    const active = style.promptVersions.filter((p) => p.status === PromptStatus.ACTIVE);
    const compiled = Boolean(STYLE_PROMPTS[style.promptKey]);
    return {
      name: style.name,
      promptKey: style.promptKey,
      dbPromptVersions: style.promptVersions.length,
      activeDbPrompts: active.length,
      compiledSourcePrompt: compiled,
      effectiveProductionPrompt: active.length > 0 || compiled,
    };
  });

  return NextResponse.json({
    totalActiveHairstyles: audit.length,
    noPromptVersionsAtAll: audit.filter((x) => x.dbPromptVersions === 0).map((x) => x.name),
    noActiveDbPrompt: audit.filter((x) => x.activeDbPrompts === 0).map((x) => x.name),
    noEffectiveProductionPrompt: audit.filter((x) => !x.effectiveProductionPrompt).map((x) => x.name),
    audit,
  }, { headers: { "Cache-Control": "no-store" } });
}
