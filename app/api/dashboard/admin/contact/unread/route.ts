import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ count: 0 }, { status: 403 });
  }

  // A newly submitted contact form is represented by ContactMessage itself.
  // Replies are conversation entries and must not be used to determine whether
  // the original customer enquiry is new.
  const count = await prisma.contactMessage.count({
    where: {
      status: "NEW",
    },
  });

  return NextResponse.json({ count });
}
