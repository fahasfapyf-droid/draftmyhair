import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.PROMPT_PROMOTION_SECRET;
  const provided = request.headers.get("x-dmh-promotion-secret");
  return Boolean(expected && provided && provided === expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const promptKey = typeof body?.promptKey === "string" ? body.promptKey : null;
  const prompt = typeof body?.prompt === "string" ? body.prompt : null;
  const sourceAttemptId =
    typeof body?.sourceAttemptId === "string" ? body.sourceAttemptId : null;
  const sourceJobId =
    typeof body?.sourceJobId === "string" ? body.sourceJobId : null;
  const qaScore = typeof body?.qaScore === "number" ? body.qaScore : null;

  if (!promptKey || !prompt || !sourceAttemptId || !sourceJobId) {
    return NextResponse.json(
      { error: "promptKey, prompt, sourceAttemptId and sourceJobId are required" },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const hairstyle = await tx.hairstyle.findUnique({
      where: { promptKey },
      select: { id: true, name: true },
    });

    if (!hairstyle) return { kind: "missing_style" as const };

    const marker = `R&D source attempt: ${sourceAttemptId}`;
    const existing = await tx.promptVersion.findFirst({
      where: { hairstyleId: hairstyle.id, notes: { contains: marker } },
      select: { id: true, version: true, status: true },
    });

    if (existing) {
      return { kind: "existing" as const, promptVersionId: existing.id, version: existing.version };
    }

    await tx.promptVersion.updateMany({
      where: { hairstyleId: hairstyle.id, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const latest = await tx.promptVersion.findFirst({
      where: { hairstyleId: hairstyle.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const version = (latest?.version ?? 0) + 1;
    const created = await tx.promptVersion.create({
      data: {
        hairstyleId: hairstyle.id,
        version,
        prompt,
        status: "ACTIVE",
        qaStatus: "PASSED",
        notes: [
          "Promoted automatically after explicit human approval in R&D Preview.",
          marker,
          `R&D source job: ${sourceJobId}`,
          `Automated QA overall: ${qaScore == null ? "n/a" : qaScore}`,
        ].join("\n"),
      },
      select: { id: true, version: true },
    });

    return { kind: "created" as const, promptVersionId: created.id, version: created.version, hairstyle: hairstyle.name };
  });

  if (result.kind === "missing_style") {
    return NextResponse.json(
      { error: `Production hairstyle not found for promptKey: ${promptKey}` },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
