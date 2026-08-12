import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isAdmin } from "@/lib/auth/authorization";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeImage } from "@/lib/image/normalize";
import {
  createGeneratePreviewJob,
  runGeneratePreviewJob,
} from "@/lib/jobs/generate-preview.job";
import {
  consumeCredits,
  InsufficientCreditsError,
  refundCredits,
} from "@/lib/services/credit.service";
import { deleteQueuedGeneration } from "@/lib/services/generation-lifecycle.service";

export const maxDuration = 300;

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let creditsConsumed = false;
  let userId: string | undefined;
  let generationId: string | undefined;

  const refundIfNeeded = async (description = "Generation request failed") => {
    if (!creditsConsumed || !userId) {
      return;
    }

    try {
      await refundCredits({
        userId,
        generationId,
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

    // Validate the request before charging credits. Invalid uploads,
    // prompt keys, and generation IDs must never consume a user's balance.
    const formData = await request.formData();
    const image = formData.get("image");
    const promptKey = formData.get("promptKey");
    const requestedGenerationId = formData.get("generationId");
    const requestedSalonClientId = formData.get("salonClientId");

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
          error: "Image exceeds the 10 MB upload limit.",
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

    const salonClientId =
      typeof requestedSalonClientId === "string" && requestedSalonClientId.trim()
        ? requestedSalonClientId.trim()
        : null;

    if (salonClientId) {
      if (session.user.role !== "SALON") {
        return NextResponse.json(
          {
            success: false,
            error: "Salon client previews require a salon account.",
          },
          { status: 403 }
        );
      }

      const client = await prisma.salonClient.findFirst({
        where: { id: salonClientId, salonId: userId },
        select: { id: true },
      });

      if (!client) {
        return NextResponse.json(
          {
            success: false,
            error: "Client not found in this salon.",
          },
          { status: 404 }
        );
      }
    }

    generationId =
      typeof requestedGenerationId === "string"
        ? requestedGenerationId
        : randomUUID();

    // A retried POST with the same generation ID must not charge again or
    // create a second generation. Return the existing generation instead.
    if (requestedGenerationId) {
      const existingGeneration = await prisma.generation.findFirst({
        where: {
          id: generationId,
          userId,
        },
        select: {
          status: true,
          resultStorageKey: true,
          errorMessage: true,
        },
      });

      if (existingGeneration) {
        return NextResponse.json({
          success: true,
          generationId,
          imageUrl:
            existingGeneration.status === "COMPLETED" &&
            existingGeneration.resultStorageKey
              ? `/api/blob?pathname=${encodeURIComponent(existingGeneration.resultStorageKey)}`
              : null,
          status: existingGeneration.status,
          error: existingGeneration.errorMessage,
        });
      }
    }

    // Normalize the source image and create the Generation before recording
    // the credit debit. CreditTransaction.generationId is a foreign key to
    // Generation.id, so the parent row must exist before the debit row.
    const normalizedImage = await normalizeImage(
      Buffer.from(await image.arrayBuffer()),
      image.type
    );

    const jobPreparation = await createGeneratePreviewJob({
      generationId,
      userId,
      promptKey: promptKey.trim(),
      imageBuffer: normalizedImage.buffer,
      mimeType: normalizedImage.mimeType,
    });

    if (!jobPreparation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: jobPreparation.error,
        },
        { status: jobPreparation.status }
      );
    }

    if (!isAdmin(session)) {
      try {
        const consumption = await consumeCredits({
          userId,
          amount: 1,
          generationId,
          description: "AI hairstyle generation",
        });

        if (consumption.alreadyConsumed) {
          return NextResponse.json(
            {
              success: false,
              error: "This generation request is already being processed.",
              generationId,
            },
            { status: 409 }
          );
        }

        creditsConsumed = true;
      } catch (error) {
        try {
          await deleteQueuedGeneration(generationId, userId);
        } catch (cleanupError) {
          console.error(
            "Failed to remove queued generation after credit failure:",
            cleanupError
          );
        }

        if (error instanceof InsufficientCreditsError) {
          return NextResponse.json(
            {
              success: false,
              error: error.message,
            },
            { status: 402 }
          );
        }

        console.error("Credit consumption failed:", error);

        return NextResponse.json(
          {
            success: false,
            error: "Unable to process generation credits.",
          },
          { status: 500 }
        );
      }
    }

    if (salonClientId) {
      await prisma.generation.update({
        where: { id: generationId },
        data: { salonClientId },
      });
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

    // The server owns the final generation identifier. The client verifies it
    // before beginning status polling.
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
    await refundIfNeeded("Unexpected generation API error");

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
