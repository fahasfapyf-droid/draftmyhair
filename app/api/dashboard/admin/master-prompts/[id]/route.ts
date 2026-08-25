import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ENVIRONMENT = "PREVIEW" as const;

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id || id.startsWith("compiled:")) return NextResponse.json({ error: "Compiled prompts cannot be edited directly." }, { status: 400 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : undefined;
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : undefined;
  const qaStatus = typeof body?.qaStatus === "string" && ["DRAFT", "TESTING", "PASSED"].includes(body.qaStatus) ? body.qaStatus : undefined;
  const status = body?.status === "ACTIVE" ? "ACTIVE" : body?.status === "ARCHIVED" ? "ARCHIVED" : body?.status === "DRAFT" ? "DRAFT" : undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.$queryRaw<{ id: string; prompt: string; notes: string | null; qaStatus: string; status: string }[]>(Prisma.sql`
        SELECT "id", "prompt", "notes", "qaStatus", "status"
        FROM "MasterPromptVersion"
        WHERE "id" = ${id} AND "environment" = ${ENVIRONMENT}::"MasterPromptEnvironment"
        LIMIT 1
      `);
      if (!current[0]) throw new Error("NOT_FOUND");

      if (status === "ACTIVE") {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "MasterPromptVersion"
          SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "environment" = ${ENVIRONMENT}::"MasterPromptEnvironment" AND "status" = 'ACTIVE' AND "id" <> ${id}
        `);
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE "MasterPromptVersion"
        SET
          "prompt" = COALESCE(${prompt ?? null}, "prompt"),
          "notes" = CASE WHEN ${notes !== undefined} THEN ${notes ?? null} ELSE "notes" END,
          "qaStatus" = COALESCE(${qaStatus ?? null}::"PromptQAStatus", "qaStatus"),
          "status" = COALESCE(${status ?? null}::"PromptStatus", "status"),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id} AND "environment" = ${ENVIRONMENT}::"MasterPromptEnvironment"
      `);

      const updated = await tx.$queryRaw(Prisma.sql`
        SELECT "id", "version", "prompt", "status", "qaStatus", "environment", "notes", "createdAt", "updatedAt"
        FROM "MasterPromptVersion"
        WHERE "id" = ${id}
        LIMIT 1
      `);
      return updated[0];
    });

    if (!result) return NextResponse.json({ error: "Master prompt version not found." }, { status: 404 });
    return NextResponse.json({ version: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Master prompt version not found." }, { status: 404 });
    console.error("Admin master prompt update failed:", error);
    return NextResponse.json({ error: "Unable to update master prompt version." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id || id.startsWith("compiled:")) return NextResponse.json({ error: "Compiled prompts cannot be deleted." }, { status: 400 });

  try {
    const deleted = await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "MasterPromptVersion"
      WHERE "id" = ${id} AND "environment" = ${ENVIRONMENT}::"MasterPromptEnvironment"
    `);
    if (!deleted) return NextResponse.json({ error: "Master prompt version not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin master prompt delete failed:", error);
    return NextResponse.json({ error: "Unable to delete master prompt version." }, { status: 400 });
  }
}
