import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";
import { generateAutonomousPrompt } from "@/lib/rnd/autonomous-prompt";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const styles = await prisma.hairstyle.findMany({
    where: { isActive: true },
    orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, serviceType: true, gender: true, category: true },
  });
  return NextResponse.json({ styles }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const styleIds = Array.isArray(body?.styleIds) ? body.styleIds.filter((x: unknown): x is string => typeof x === "string") : [];
  const sourceAssetIds = Array.isArray(body?.sourceAssetIds) ? body.sourceAssetIds.filter((x: unknown): x is string => typeof x === "string") : [];
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!styleIds.length || !sourceAssetIds.length) return NextResponse.json({ error: "Select at least one style and one source photo." }, { status: 400 });
  if (styleIds.length * sourceAssetIds.length > 100) return NextResponse.json({ error: "This run is limited to 100 style/source combinations." }, { status: 400 });

  const [styles, sources] = await Promise.all([
    prisma.hairstyle.findMany({
      where: { id: { in: styleIds }, isActive: true },
      select: { id: true, name: true, slug: true, promptKey: true, serviceType: true },
    }),
    prisma.rnDAsset.findMany({ where: { id: { in: sourceAssetIds }, kind: "SOURCE" }, select: { id: true } }),
  ]);

  if (styles.length !== styleIds.length || sources.length !== sourceAssetIds.length) {
    return NextResponse.json({ error: "One or more selected styles or source photos no longer exist." }, { status: 400 });
  }

  const missingPrompt = styles.find((style) => !STYLE_PROMPTS[style.promptKey]?.prompt);
  if (missingPrompt) {
    return NextResponse.json({ error: "Authoritative production prompt is missing for " + missingPrompt.promptKey }, { status: 500 });
  }

  const campaignName = name || "R&D Run " + new Date().toISOString().slice(0, 16).replace("T", " ");
  const campaign = await prisma.rnDCampaign.create({ data: { name: campaignName, status: "RUNNING", autoAdvanceEnabled: true, createdByUserId: session.user.id } });

  let created = 0;
  for (const style of styles) {
    for (const source of sources) {
      const instruction = "Validate the production hairstyle definition for " + style.name + ". Transform only the requested service while preserving the subject identity and original photograph.";
      const built = await generateAutonomousPrompt(instruction, STYLE_PROMPTS[style.promptKey].prompt);

      const target = await prisma.rnDTarget.create({
        data: {
          campaignId: campaign.id,
          targetType: "SINGLE",
          targetKey: "rnd-" + style.slug + "-" + source.id.slice(-8) + "-" + Date.now() + "-" + created,
          hairstyleId: style.id,
          hardCoreInstruction: instruction,
          sourceAssetId: source.id,
          status: "QUEUED",
        },
      });

      await prisma.rnDJob.create({
        data: {
          targetId: target.id,
          status: "QUEUED",
          promptVersionNumber: 1,
          currentPrompt: built.prompt,
          queuedAt: new Date(),
        },
      });
      created++;
    }
  }

  return NextResponse.json({ ok: true, campaignId: campaign.id, created, message: created + " R&D jobs queued." });
}
