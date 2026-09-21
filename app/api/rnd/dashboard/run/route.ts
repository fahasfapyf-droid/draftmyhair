import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  const assignments = Array.isArray(body?.assignments)
    ? body.assignments
        .filter((x: unknown): x is { styleId: string; sourceAssetId: string } => Boolean(x && typeof x === "object" && typeof (x as { styleId?: unknown }).styleId === "string" && typeof (x as { sourceAssetId?: unknown }).sourceAssetId === "string"))
        .map((x: { styleId: string; sourceAssetId: string }) => ({ styleId: x.styleId, sourceAssetId: x.sourceAssetId }))
    : [];
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const uniqueAssignments = Array.from(new Map(assignments.map((x) => [x.styleId + ":" + x.sourceAssetId, x])).values());
  if (!uniqueAssignments.length) return NextResponse.json({ error: "Assign a source photo to at least one R&D target." }, { status: 400 });
  if (uniqueAssignments.length > 100) return NextResponse.json({ error: "This run is limited to 100 target/photo combinations." }, { status: 400 });
  const styleIds = Array.from(new Set(uniqueAssignments.map((x) => x.styleId)));
  const sourceAssetIds = Array.from(new Set(uniqueAssignments.map((x) => x.sourceAssetId)));
  const [styles, sources] = await Promise.all([
    prisma.hairstyle.findMany({ where: { id: { in: styleIds }, isActive: true }, select: { id: true, name: true, slug: true, serviceType: true } }),
    prisma.rnDAsset.findMany({ where: { id: { in: sourceAssetIds }, kind: "SOURCE" }, select: { id: true } }),
  ]);
  if (styles.length !== styleIds.length || sources.length !== sourceAssetIds.length) return NextResponse.json({ error: "One or more selected targets or source photos no longer exist." }, { status: 400 });
  const campaignName = name || "R&D Run " + new Date().toISOString().slice(0, 16).replace("T", " ");
  const campaign = await prisma.rnDCampaign.create({ data: { name: campaignName, status: "RUNNING", autoAdvanceEnabled: true, createdByUserId: session.user.id } });
  let created = 0;
  for (const assignment of uniqueAssignments) {
    const style = styles.find((x) => x.id === assignment.styleId)!;
    const source = sources.find((x) => x.id === assignment.sourceAssetId)!;
    const instruction = "Develop a production-quality " + style.name + " " + style.serviceType.toLowerCase().replaceAll("_", " ") + " transformation. This is an R&D validation run; transform only the requested service while preserving the subject identity and original photograph.";
    const built = await generateAutonomousPrompt(instruction);
    const target = await prisma.rnDTarget.create({
      data: { campaignId: campaign.id, targetType: "SINGLE", targetKey: "rnd-" + style.slug + "-" + source.id.slice(-8) + "-" + Date.now() + "-" + created, hairstyleId: style.id, hardCoreInstruction: instruction, sourceAssetId: source.id, status: "QUEUED" },
    });
    await prisma.rnDJob.create({ data: { targetId: target.id, status: "QUEUED", promptVersionNumber: 1, currentPrompt: built.prompt, queuedAt: new Date() } });
    created++;
  }
  return NextResponse.json({ ok: true, campaignId: campaign.id, created, message: created + " R&D jobs queued." });
}
