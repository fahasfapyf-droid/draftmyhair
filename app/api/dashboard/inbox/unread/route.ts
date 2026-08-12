import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "USER") {
    return NextResponse.json({ unreadCount: 0 });
  }

  const unreadCount = await prisma.contactMessageReply.count({
    where: {
      senderRole: "ADMIN",
      readAt: null,
      contactMessage: {
        userId: session.user.id,
      },
    },
  });

  return NextResponse.json(
    { unreadCount },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
