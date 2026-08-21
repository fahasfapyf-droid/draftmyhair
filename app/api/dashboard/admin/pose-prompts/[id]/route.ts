import crypto from "node:crypto";
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : undefined;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : undefined;
  const qaStatus = typeof body.qaStatus === "string" && Object.values(PromptQAStatus).includes(body.qaStatus) ? body.qaStatus as PromptQAStatus : undefined;
  const status = typeof body.status === "string" && Object.values(PromptStatus).includes(body.status) ? body.status as PromptStatus : undefined;

  if (id.startsWith("compiled:")) {
    const nextName = name || "Strict Pose Lock";
    const nextSlug = slug || "strict-pose-lock";
    const nextPrompt = prompt || POSE_PROMPT.trim();
    const nextStatus = status === PromptStatus.ACTIVE ? PromptStatus.ACTIVE : PromptStatus.DRAFT;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const latest = await tx.$queryRaw<{ version: number }[]>(Prisma.sql`
          SELECT "version" FROM "PosePromptVersion" WHERE "slug" = ${nextSlug} ORDER BY "version" DESC LIMIT 1
        `);
        const version = (latest[0]?.version ?? 0) + 1;
        if (nextStatus === PromptStatus.ACTIVE) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE "PosePromptVersion" SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
            WHERE "status" = 'ACTIVE'
          `);
        }
        const newId = crypto.randomUUID();
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "PosePromptVersion" ("id", "name", "slug", "version", "prompt", "status", "qaStatus", "notes", "createdAt", "updatedAt")
          VALUES (${newId}, ${nextName}, ${nextSlug}, ${version}, ${nextPrompt}, ${nextStatus}, ${qaStatus ?? PromptQAStatus.PASSED}, ${notes ?? "Imported from compiled production pose prompt."}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        const created = await tx.$queryRaw<PosePromptRow[]>(Prisma.sql`
          SELECT "id", "name", "slug", "version", "prompt", "status", "qaStatus", "notes", "createdAt", "updatedAt"
          FROM "PosePromptVersion" WHERE "id" = ${newId}
        `);
        return created[0];
      });
      return NextResponse.json({ prompt: result }, { status: 201 });
    } catch (error) {
      console.error("Admin compiled pose prompt import failed:", error);
      return NextResponse.json({ error: "Unable to create database pose prompt version." }, { status: 400 });
    }
  }

  const existing = await prisma.$queryRaw<PosePromptRow[]>(Prisma.sql`
    SELECT "id", "name", "slug", "version", "prompt", "status", "qaStatus", "notes", "createdAt", "updatedAt"
    FROM "PosePromptVersion" WHERE "id" = ${id}
  `);
  if (!existing[0]) return NextResponse.json({ error: "Pose prompt version not found." }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      if (status === PromptStatus.ACTIVE) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "PosePromptVersion" SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "status" = 'ACTIVE' AND "id" <> ${id}
        `);
      }

      const nextName = name ?? existing[0].name;
      const nextSlug = slug ?? existing[0].slug;
      const nextPrompt = prompt ?? existing[0].prompt;
      const nextStatus = status ?? existing[0].status;
      const nextQaStatus = qaStatus ?? existing[0].qaStatus;
      const nextNotes = notes !== undefined ? notes : existing[0].notes;

      await tx.$executeRaw(Prisma.sql`
        UPDATE "PosePromptVersion"
        SET "name" = ${nextName}, "slug" = ${nextSlug}, "prompt" = ${nextPrompt}, "status" = ${nextStatus}, "qaStatus" = ${nextQaStatus}, "notes" = ${nextNotes}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}
      `);
    });

    const updated = await prisma.$queryRaw<PosePromptRow[]>(Prisma.sql`
      SELECT "id", "name", "slug", "version", "prompt", "status", "qaStatus", "notes", "createdAt", "updatedAt"
      FROM "PosePromptVersion" WHERE "id" = ${id}
    `);
    return NextResponse.json({ prompt: updated[0] });
  } catch (error) {
    console.error("Admin pose prompt update failed:", error);
    return NextResponse.json({ error: "Unable to update pose prompt version." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (id.startsWith("compiled:")) return NextResponse.json({ error: "Compiled production pose prompts cannot be deleted." }, { status: 409 });

  try {
    const existing = await prisma.$queryRaw<{ name: string }[]>(Prisma.sql`
      SELECT "name" FROM "PosePromptVersion" WHERE "id" = ${id}
    `);
    if (!existing[0]) return NextResponse.json({ error: "Pose prompt version not found." }, { status: 404 });
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "PosePromptVersion" WHERE "id" = ${id}`);
    return NextResponse.json({ deleted: true, name: existing[0].name });
  } catch (error) {
    console.error("Admin pose prompt delete failed:", error);
    return NextResponse.json({ error: "Unable to delete pose prompt version." }, { status: 400 });
  }
}
