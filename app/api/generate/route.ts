import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { auth } from "@/auth";
import {
  createGeneratePreviewJob,
  runGeneratePreviewJob,
} from "@/lib/jobs/generate-preview.job";
import {
  consumeCredits,
  refundCredits,
} from "@/lib/services/credit.service";

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let creditsConsumed = false;
  let userId: string | undefined;

  const refundIfNeeded = async (description?: string) => {
    if (!creditsConsumed || !userId || !description) {
      return;
    }

    try {
      await refundCredits({
        userId,
        description,
      });

      creditsConsumed = false;
    } catch (error) {
      console.error("Failed to refund credits:", error);
    }
  };

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    userId = session.user.id;

    try {
      await consumeCredits({
        userId,
        amount: 1,
        description: "AI hairstyle generation",
      });

      creditsConsumed = true;
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to consume credits.",
        },
        { status: 402 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const promptKey = formData.get("promptKey");
    const requestedGenerationId = formData.get("generationId");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Image is required.",
        },
        { status: 400 }
      );
    }

    if (typeof promptKey !== "string" || promptKey.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Hairstyle prompt key is required.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported image format: ${image.type}`,
        },
        { status: 400 }
      );
    }

    if (image.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Image exceeds the 20 MB upload limit.",
        },
        { status: 413 }
      );
    }

    if (image.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Image is empty.",
        },
        { status: 400 }
      );
    }

    if (
      requestedGenerationId !== null &&
      (typeof requestedGenerationId !== "string" ||
        !UUID_PATTERN.test(requestedGenerationId))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid generation identifier.",
        },
        { status: 400 }
      );
    }

    const generationId =
      typeof requestedGenerationId === "string"
        ? requestedGenerationId
        : randomUUID();

    const jobPreparation = await createGeneratePreviewJob({
      generationId,
      userId,
      promptKey: promptKey.trim(),
      imageBuffer: Buffer.from(await image.arrayBuffer()),
      mimeType: image.type,
      originalFilename: image.name,
    });

    if (!jobPreparation.ok) {
      await refundIfNeeded(jobPreparation.refundDescription);

      return NextResponse.json(
        {
          success: false,
          error: jobPreparation.error,
        },
        { status: jobPreparation.status }
      );
    }

    const execution = await runGeneratePreviewJob(jobPreparation.job);

    if (!execution.ok) {
      await refundIfNeeded(execution.refundDescription);

      return NextResponse.json(
        {
          success: false,
          error: execution.error,
        },
        { status: execution.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        imageUrl: execution.imageUrl,
        generationId: execution.generationId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Generation API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
