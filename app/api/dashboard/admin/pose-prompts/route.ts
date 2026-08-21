import { NextResponse } from "next/server";
import { Prisma, PromptQAStatus, PromptStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POSE_PROMPT } from "@/lib/engine/prompts/pose";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

type PosePromptRow = {
  id: string;
  name: string;
  slug: string;
  version: number;
  prompt: string;
  status: PromptStatus;
  qaStatus: PromptQAStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRaw<PosePromptRow[]>(Prisma.sql`
    SELECT "id", "name", "slug", "version", "prompt", "status", "qaStatus", "notes", "createdAt", "updatedAt"
    FROM "PosePromptVersion"
    ORDER BY "slug" ASC, "version" DESC
  `);

  const hasActive = rows.some((row) => row.status === PromptStatus.ACTIVE);
  const prompts = hasActive
    ? rows
    : [{
        id: "compiled:strict-pose-lock",
        name: "Strict Pose Lock",
        slug: "strict-pose-lock",
        version: 0,
        prompt: POSE_PROMPT.trim(),
        status: "COMPILED",
        qaStatus: "PASSED",
        notes: "Compiled production pose prompt. It is read-only; saving it creates a database version. No database pose prompt is active until an administrator explicitly activates one.",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }, ...rows];

  return NextResponse.json({ prompts }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const qaStatus = typeof body.qaStatus === "string" && Object.values(PromptQAStatus).includes(body.qaStatus) ? body.qaStatus as PromptQAStatus : PromptQAStatus.DRAFT;
  const status = body.status === PromptStatus.ACTIVE ? PromptStatus.ACTIVE : body.status === PromptStatus.ARCHIVED ? PromptStatus.ARCHIVED : PromptStatus.DRAFT;

  if (!name || !slug || !prompt) return NextResponse.json({ error: "Name, slug and prompt are required." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.$queryRaw<{ version: number }[]>(Prisma.sql`
        SELECT "version" FROM "PosePromptVersion" WHERE "slug" = ${slug} ORDER BY "version" DESC LIMIT 1
      `);
      const version = (latest[0]?.version ?? 0) + 1;

      if (status === PromptStatus.ACTIVE) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "PosePromptVersion" SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "status" = 'ACTIVE'
        `);
      }

      const id = crypto.randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PosePromptVersion" ("id", "name", "slug", "version", "prompt", "status", "qaStatus", "notes", "createdAt", "updatedAt")
        VALUES (${id}, ${name}, ${slug}, ${version}, ${prompt}, ${status}, ${qaStatus}, ${notes}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const created = await tx.$queryRaw<PosePromptRow[]>(Prisma.sql`
        SELECT "id", "name", "slug", "version", "prompt", "status", "qaStatus", "notes", "createdAt", "updatedAt"
        FROM "PosePromptVersion" WHERE "id" = ${id}
      `);
      return created[0];
    });

    return NextResponse.json({ prompt: result }, { status: 201 });
  } catch (error) {
    console.error("Admin pose prompt create failed:", error);
    return NextResponse.json({ error: "Unable to create pose prompt version." }, { status: 400 });
  }
}
