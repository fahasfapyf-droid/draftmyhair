import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be 12 MB or smaller" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const pathname = `content/gallery/${Date.now()}-${safeName}`;

  // The project's Blob store is private. Keep gallery originals private in storage
  // and expose only the explicitly gallery-scoped media route to the public site.
  const blob = await put(pathname, file, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.type,
  });

  const publicUrl = `/api/gallery/media?pathname=${encodeURIComponent(blob.pathname)}`;
  return NextResponse.json({ url: publicUrl, pathname: blob.pathname });
}
