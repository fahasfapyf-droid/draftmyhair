import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ count: 0 }, { status: 403 });
  }

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  if (!since || Number.isNaN(since.getTime())) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.feedback.count({
    where: {
      createdAt: { gt: since },
    },
  });

  return NextResponse.json({ count });
}
