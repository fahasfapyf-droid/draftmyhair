import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

const TARGET = 86;

function prompt(name: string, type: string, compiled?: string) {
  if (compiled) return compiled;
  const locks = "Preserve the original face, facial features, skin texture, skin tone, expression, jawline, ears, head position, skull geometry, framing, perspective, lighting, exposure, color balance, focus, grain and background exactly. Modify only the requested target region. No regeneration, reshaping, beauty filtering, artificial edges, halos, wig effect, background change or geometry drift.";
  if (type === "HAIR_COLOR") return `INITIAL DRAFT — ${name}\n\nINPAINT HAIR COLOR ONLY.\n\n${locks}\n\nChange only the existing hair color to ${name}. Preserve the existing haircut, length, perimeter, texture, density and styling exactly. Maintain natural root authority, realistic variation and scalp integration.\n\nFINAL STANDARD: photorealistic original photograph with only the hair color changed.`;
  if (type === "BEARD_REMOVAL") return `INITIAL DRAFT — ${name}\n\nINPAINT FACIAL HAIR ONLY.\n\n${locks}\n\nApply ${name} only to the facial-hair region. Preserve underlying skin texture and facial anatomy.\n\nFINAL STANDARD: photorealistic original face with only the requested facial-hair transformation.`;
  if (type === "BEARD") return `INITIAL DRAFT — ${name}\n\nINPAINT FACIAL HAIR ONLY.\n\n${locks}\n\nCreate ${name} as the requested facial-hair style. Modify only facial hair; preserve natural density, growth direction, edges, cheek and neckline behavior and realistic skin integration.\n\nFINAL STANDARD: photorealistic facial hair with the original face completely unchanged.`;
  if (type === "BUZZ_CUT" || type === "BALD") return `INITIAL DRAFT — ${name}\n\nINPAINT HAIR/SCALP REGION ONLY.\n\n${locks}\n\nCreate the requested ${name} result. Preserve the fixed skull and exact head proportions. Control hair density, scalp visibility, hairline, stubble or exposed scalp and realistic shadow transitions.\n\nFINAL STANDARD: photorealistic result with identical identity and geometry.`;
  return `INITIAL DRAFT — ${name}\n\nINPAINT HAIR ONLY.\n\n${locks}\nThe skull is a rigid fixed object; only the surface hair changes.\n\nCreate the requested ${name} hairstyle. Preserve natural scalp/root integration, realistic density, roots, shadows, strand behavior and lighting continuity.\n\nFINAL STANDARD: photorealistic hairstyle transformation with the same face and identical photograph geometry.`;
}

export async function POST() {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const targets = await tx.hairstyle.findMany({
        where: { isActive: true, promptVersions: { none: {} } },
        select: { id: true, name: true, promptKey: true, serviceType: true },
        orderBy: { name: "asc" },
      });
      if (targets.length !== TARGET) throw new Error(`ABORT: expected ${TARGET}, found ${targets.length}`);
      const rows = targets.map(s => ({
        hairstyleId: s.id,
        version: 1,
        prompt: prompt(s.name, s.serviceType, s.serviceType === "HAIRSTYLE" ? STYLE_PROMPTS[s.promptKey]?.prompt : undefined),
        status: "DRAFT" as const,
        qaStatus: "DRAFT" as const,
        notes: "Initial population baseline. Pending prompt-by-prompt R&D review and refinement; not approved for activation.",
      }));
      await tx.promptVersion.createMany({ data: rows });
      const created = await tx.promptVersion.count({ where: { hairstyleId: { in: targets.map(x => x.id) }, version: 1, status: "DRAFT", qaStatus: "DRAFT" } });
      if (created !== TARGET) throw new Error(`ABORT: post-check expected ${TARGET}, found ${created}`);
      return { expected: TARGET, matched: targets.length, created, draftOnly: created };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Populate promptless entries failed:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Mutation failed" }, { status: 400 });
  }
}