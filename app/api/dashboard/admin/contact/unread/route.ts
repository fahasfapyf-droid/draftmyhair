import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  const unreadReplies = await prisma.contactMessageReply.findMany({
    where: {
      senderRole: "USER",
      readAt: null,
    },
    distinct: ["contactMessageId"],
    select: {
      contactMessageId: true,
    },
  });

  return NextResponse.json(
    { count: unreadReplies.length },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
