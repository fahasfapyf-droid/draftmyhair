import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MASTER_PROMPT_V3_SINGLE, PROMPT_VERSION_V3_SINGLE } from "@/lib/engine/prompts/master-v3-single";

const ENVIRONMENT = "PREVIEW" as const;

type MasterPromptRow = {
  id: string;
  version: number;
  prompt: string;
  status: string;
  qaStatus: string;
  environment: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRaw<MasterPromptRow[]>`
    SELECT "id", "version", "prompt", "status", "qaStatus", "environment", "notes", "createdAt", "updatedAt"
    FROM "MasterPromptVersion"
    WHERE "environment" = ${ENVIRONMENT}::"MasterPromptEnvironment"
    ORDER BY "version" DESC
  `;

  const versions = rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));

  return NextResponse.json({
    environment: ENVIRONMENT,
    compiled: {
      id: "compiled:v3-single",
      version: 0,
      prompt: MASTER_PROMPT_V3_SINGLE,
      status: "COMPILED",
      qaStatus: "PASSED",
      environment: ENVIRONMENT,
      notes: `Compiled production master prompt. Source version: ${PROMPT_VERSION_V3_SINGLE}. Editing it creates a database preview version; the compiled source remains untouched.`,
    },
    activeVersion: versions.find((version) => version.status === "ACTIVE") ?? null,
    versions,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;
  const qaStatus = typeof body?.qaStatus === "string" && ["DRAFT", "TESTING", "PASSED"].includes(body.qaStatus) ? body.qaStatus : "DRAFT";
  const status = body?.status === "ACTIVE" ? "ACTIVE" : "DRAFT";

  if (!prompt) return NextResponse.json({ error: "Master prompt is required." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.$queryRaw<{ version: number }[]>`
        SELECT "version" FROM "MasterPromptVersion"
        WHERE "environment" = ${ENVIRONMENT}::"MasterPromptEnvironment"
        ORDER BY "version" DESC
        LIMIT 1
      `;
      const version = (latest[0]?.version ?? 0) + 1;

      if (status === "ACTIVE") {
        await tx.$executeRaw`
          UPDATE "MasterPromptVersion"
          SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "environment" = ${ENVIRONMENT}::"MasterPromptEnvironment" AND "status" = 'ACTIVE'
        `;
      }

      const id = crypto.randomUUID();
      await tx.$executeRaw`
        INSERT INTO "MasterPromptVersion" ("id", "version", "prompt", "status", "qaStatus", "environment", "notes", "createdAt", "updatedAt")
        VALUES (${id}, ${version}, ${prompt}, CAST(${status} AS "PromptStatus"), CAST(${qaStatus} AS "PromptQAStatus"), ${ENVIRONMENT}::"MasterPromptEnvironment", ${notes}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      return { id, version, prompt, status, qaStatus, environment: ENVIRONMENT, notes };
    });

    return NextResponse.json({ version: result }, { status: 201 });
  } catch (error) {
    console.error("Admin master prompt create failed:", error);
    return NextResponse.json({ error: "Unable to create master prompt version." }, { status: 400 });
  }
}
