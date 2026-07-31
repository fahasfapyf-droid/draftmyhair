import { get } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname");

  if (!pathname) {
    return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
  }

  const image = await prisma.image.findUnique({
    where: { storageKey: pathname },
    select: { ownerId: true, storageKey: true },
  });

  if (!image || image.ownerId !== session.user.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const result = await get(image.storageKey, {
    access: "private",
  });

  if (!result) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}