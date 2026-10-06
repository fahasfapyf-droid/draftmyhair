import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRANCH = "chore/batch-1-30-architecture";

const BATCH_NAMES = [
  "Asymmetrical Bob",
  "Bixie",
  "Blunt Bob",
  "Blunt Lob",
  "Bowl Cut",
  "Boyish Pixie",
  "Butterfly Cut",
  "C-Cut",
  "Chelsea Cut",
  "Chin-Length Bob",
  "Classic Bob",
  "Classic Rounded Precision Bob with Full Blunt Fringe",
  "Crew Cut",
  "Curtain Layers",
  "Curtains",
  "Face-Framing Layers",
  "Faux Hawk",
  "French Bob",
  "French Bob — No Bangs",
  "French Bob — With Bangs",
  "French Crop",
  "Hime Cut",
  "Hush Cut",
  "Italian Bob",
  "Ivy League",
  "Jaw-Length Bob",
  "Jellyfish Cut",
  "Kicktail Bobcut",
  "Korean Layer Cut",
  "Layered Bob",
] as const;

function allowed() {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === BRANCH;
}

function blocked() {
  return NextResponse.json({ error: "Route restricted to the dedicated preview branch" }, { status: 404 });
}

export async function GET() {
  if (!allowed()) return blocked();

  const rows = await prisma.hairstyle.findMany({
    where: { isActive: true, name: { in: [...BATCH_NAMES] } },
    select: {
      id: true,
      name: true,
      slug: true,
      promptKey: true,
      displayOrder: true,
      promptVersions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, status: true, qaStatus: true, prompt: true, notes: true },
      },
    },
  });

  const byName = new Map(rows.map((row) => [row.name, row]));
  const ordered = BATCH_NAMES.map((name, index) => ({
    batchNumber: index + 1,
    requestedName: name,
    row: byName.get(name) ?? null,
  }));

  return NextResponse.json({ count: ordered.length, found: rows.length, rows: ordered });
}

export async function POST(request: Request) {
  if (!allowed()) return blocked();

  const body = await request.json().catch(() => null);
  const promptVersionId = typeof body?.promptVersionId === "string" ? body.promptVersionId : null;
  const expectedPrompt = typeof body?.expectedPrompt === "string" ? body.expectedPrompt : null;
  const newPrompt = typeof body?.newPrompt === "string" ? body.newPrompt : null;
  const note = typeof body?.note === "string" ? body.note : null;

  if (!promptVersionId || !expectedPrompt || !newPrompt || !note) {
    return NextResponse.json({ error: "promptVersionId, expectedPrompt, newPrompt and note are required" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.promptVersion.findUnique({
      where: { id: promptVersionId },
      select: { id: true, hairstyleId: true, version: true, status: true, qaStatus: true, prompt: true },
    });

    if (!before) return { kind: "missing" as const };
    if (before.status !== "DRAFT") return { kind: "protected" as const, status: before.status };
    if (before.prompt !== expectedPrompt) return { kind: "mismatch" as const };

    const updated = await tx.promptVersion.update({
      where: { id: promptVersionId },
      data: { prompt: newPrompt, notes: note, qaStatus: "DRAFT" },
      select: { id: true, hairstyleId: true, version: true, status: true, qaStatus: true, prompt: true },
    });

    return { kind: "updated" as const, before, updated };
  });

  if (result.kind === "missing") return NextResponse.json({ error: "PromptVersion not found" }, { status: 404 });
  if (result.kind === "protected") return NextResponse.json({ error: "Target is not DRAFT; mutation refused", status: result.status }, { status: 409 });
  if (result.kind === "mismatch") return NextResponse.json({ error: "Exact target prompt mismatch; mutation refused" }, { status: 409 });

  return NextResponse.json(result);
}
