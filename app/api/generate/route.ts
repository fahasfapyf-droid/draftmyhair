import { NextResponse } from "next/server";

import { generatePreview } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const image = formData.get("image");
    const styleId = formData.get("styleId");
    const userId = formData.get("userId");

    // ------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Image is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (typeof styleId !== "string" || styleId.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Style ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ------------------------------------------------------------
    // Convert File -> Buffer
    // ------------------------------------------------------------

    const arrayBuffer = await image.arrayBuffer();

    const imageBuffer = Buffer.from(arrayBuffer);

    // ------------------------------------------------------------
    // Engine
    // ------------------------------------------------------------

    const result = await generatePreview({
      imageBuffer,
      mimeType: image.type,
      styleId,
      userId: typeof userId === "string" ? userId : undefined,
    });

    if (!result.success) {
      return NextResponse.json(result, {
        status: 400,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Generation API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}