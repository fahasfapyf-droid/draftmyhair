import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Only JPG, PNG and WebP images are allowed." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_SIZE) return NextResponse.json({ error: "Image must be between 1 byte and 4 MB." }, { status: 400 });

  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const pathname = `content/gallery/${crypto.randomUUID()}.${extension}`;

  try {
    // The attached Blob store is private. Keep objects private in storage and
    // expose gallery media only through the controlled server-side media route.
    const blob = await put(pathname, file, { access: "private", addRandomSuffix: false, contentType: file.type });
    const url = `/api/gallery/media?pathname=${encodeURIComponent(blob.pathname)}`;
    return NextResponse.json({ url, pathname: blob.pathname });
  } catch (error) {
    console.error("Admin content upload failed:", error);
    return NextResponse.json({ error: "Unable to upload image." }, { status: 500 });
  }
}
