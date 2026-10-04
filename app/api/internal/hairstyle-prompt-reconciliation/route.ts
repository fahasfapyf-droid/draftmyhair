import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Preview only" }, { status: 403 });
  }

  const hairstyles = await prisma.hairstyle.findMany({
    where: { serviceType: "HAIRSTYLE" },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      promptVersions: {
        orderBy: { version: "asc" },
        select: {
          id: true,
          version: true,
          status: true,
          qaStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const active = hairstyles.filter(h => h.isActive);
  const withPrompts = active.filter(h => h.promptVersions.length > 0);
  const withoutPrompts = active.filter(h => h.promptVersions.length === 0);

  return NextResponse.json({
    totalHairstyles: hairstyles.length,
    activeHairstyles: active.length,
    inactiveHairstyles: hairstyles.length - active.length,
    promptVersionRows: active.reduce((n, h) => n + h.promptVersions.length, 0),
    hairstylesWithPromptVersions: withPrompts.length,
    hairstylesWithoutPromptVersions: withoutPrompts.length,
    withPrompts: withPrompts.map(h => ({
      name: h.name,
      versions: h.promptVersions.map(v => ({
        version: v.version,
        status: v.status,
        qaStatus: v.qaStatus,
        id: v.id,
      })),
    })),
    withoutPrompts: withoutPrompts.map(h => h.name),
  });
}
