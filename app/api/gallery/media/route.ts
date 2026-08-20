import { get } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

const GALLERY_PREFIX = "content/gallery/";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get("pathname");

  if (!pathname || !pathname.startsWith(GALLERY_PREFIX)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const result = await get(pathname, { access: "private" });

    if (!result) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": result.blob.contentType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to serve gallery media:", error);
    return new NextResponse("Not found", { status: 404 });
  }
}
