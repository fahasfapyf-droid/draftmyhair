import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [styles, promptVersions] = await Promise.all([
    prisma.hairstyle.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        promptKey: true,
        serviceType: true,
        category: true,
        gender: true,
        isActive: true,
      },
    }),
    prisma.promptVersion.findMany({
      orderBy: [{ hairstyle: { name: "asc" } }, { version: "asc" }],
      select: {
        id: true,
        hairstyleId: true,
        version: true,
        prompt: true,
        status: true,
        qaStatus: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        hairstyle: {
          select: {
            id: true,
            name: true,
            promptKey: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      source: "production-database",
      styles,
      promptVersions,
      counts: {
        styles: styles.length,
        promptVersions: promptVersions.length,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="dmh-promptversion-export.json"',
      },
    },
  );
}
