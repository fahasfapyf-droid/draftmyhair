import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const existing = await prisma.promptVersion.findUnique({ where: { id }, select: { hairstyleId: true } });
  if (!existing) return NextResponse.json({ error: "Prompt version not found." }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const status = typeof body.status === "string" ? body.status : undefined;
      if (status === "ACTIVE") {
        await tx.promptVersion.updateMany({ where: { hairstyleId: existing.hairstyleId, status: "ACTIVE", id: { not: id } }, data: { status: "ARCHIVED" } });
      }

      const data: Record<string, unknown> = {};
      if (typeof body.prompt === "string") data.prompt = body.prompt.trim();
      if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
      if (typeof body.qaStatus === "string") data.qaStatus = body.qaStatus;
      if (status === "ACTIVE" || status === "ARCHIVED" || status === "DRAFT") data.status = status;

      return tx.promptVersion.update({
        where: { id },
        data,
        include: { hairstyle: { select: { id: true, name: true, promptKey: true } } },
      });
    });

    return NextResponse.json({ prompt: result });
  } catch (error) {
    console.error("Admin prompt update failed:", error);
    return NextResponse.json({ error: "Unable to update prompt version." }, { status: 400 });
  }
}
