import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { uploadToStorage } from "@/lib/storage";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const formData = await request.formData();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded" },
      { status: 400 }
    );
  }
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

if (file.size === 0) {
  return NextResponse.json(
    { error: "Uploaded file is empty." },
    { status: 400 }
  );
}

if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json(
    {
      error:
        "Only JPEG, PNG, and WebP images are supported.",
    },
    { status: 415 }
  );
}

if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    {
      error:
        "Image exceeds the 20 MB upload limit.",
    },
    { status: 413 }
  );
}
const uploaded = await uploadToStorage({
  file,
  ownerId: session.user.id,
  folder: "originals",
});

try {
  const image = await prisma.image.create({
    data: {
      ownerId: session.user.id,

      storageKey: uploaded.storageKey,
      blobUrl: uploaded.blobUrl,

      mimeType: uploaded.mimeType,
      fileSize: uploaded.fileSize,

      type: "ORIGINAL",
      status: "ACTIVE",
    },
  });

  return NextResponse.json({
    success: true,
    image,
  });
} catch (error) {
  console.error("PRISMA CREATE ERROR");
  console.error(error);

  throw error;
}
}