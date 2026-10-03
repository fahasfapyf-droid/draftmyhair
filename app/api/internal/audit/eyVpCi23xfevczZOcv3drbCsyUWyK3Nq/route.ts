import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT pv."id",pv."hairstyleId",pv."version",pv."prompt",pv."status",pv."qaStatus",pv."notes",h."name",h."slug",h."promptKey",h."category" FROM "PromptVersion" pv JOIN "Hairstyle" h ON h."id"=pv."hairstyleId" WHERE h."isActive"=true AND h."serviceType"=\'HAIRSTYLE\' ORDER BY h."name" ASC,pv."version" DESC');
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
