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
  refundCredits,
} from "@/lib/services/credit.service";

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
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    userId = session.user.id;

    const formData = await request.formData();
    const image = formData.get("image");
    const hairstyleId = formData.get("hairstyleId");
    const requestedGenerationId = formData.get("generationId");
    const salonClientId = formData.get("salonClientId");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Image is required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return NextResponse.json(
        { error: "Only JPEG and PNG images are supported." },
        { status: 400 }
      );
    }

    if (image.size <= 0 || image.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: "Image must be between 1 byte and 10 MB." },
        { status: 400 }
      );
    }

    if (typeof hairstyleId !== "string" || !hairstyleId) {
      return NextResponse.json(
        { error: "Hairstyle is required." },
        { status: 400 }
      );
    }

    if (
      requestedGenerationId !== null &&
      typeof requestedGenerationId !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid generation ID." },
        { status: 400 }
      );
    }

    if (
      requestedGenerationId &&
      !UUID_PATTERN.test(requestedGenerationId)
    ) {
      return NextResponse.json(
        { error: "Invalid generation ID." },
        { status: 400 }
      );
    }

    generationId = requestedGenerationId ?? randomUUID();

    const existingGeneration = await prisma.generation.findFirst({
      where: {
        id: generationId,
        userId: session.user.id,
      },
    });

    if (existingGeneration) {
      return NextResponse.json({
        generationId: existingGeneration.id,
        status: existingGeneration.status,
        resultStorageKey: existingGeneration.resultStorageKey,
      });
    }

    if (salonClientId !== null && typeof salonClientId !== "string") {
      return NextResponse.json(
        { error: "Invalid salon client." },
        { status: 400 }
      );
    }

    if (salonClientId && session.user.role !== "SALON") {
      return NextResponse.json(
        { error: "Only salon accounts can attach clients." },
        { status: 403 }
      );
    }

    if (salonClientId) {
      const client = await prisma.salonClient.findFirst({
        where: {
          id: salonClientId,
          salonId: session.user.id,
        },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Salon client not found." },
          { status: 404 }
        );
      }
    }

    const admin = isAdmin(session.user.role);
    const creditResult = admin
      ? { alreadyConsumed: false }
      : await consumeCredits({
          userId: session.user.id,
          generationId,
          amount: 1,
          description: "Hairstyle generation",
        });

    if (creditResult.alreadyConsumed) {
      return NextResponse.json(
        { error: "Generation has already been started." },
        { status: 409 }
      );
    }

    creditsConsumed = !admin;

    const imageBytes = Buffer.from(await image.arrayBuffer());
    const normalizedImage = await normalizeImage(imageBytes, image.type);

    const job = await createGeneratePreviewJob({
      generationId,
      userId: session.user.id,
      hairstyleId,
      sourceImage: normalizedImage.buffer,
      sourceMimeType: normalizedImage.mimeType,
      salonClientId: salonClientId ?? null,
    });

    await runGeneratePreviewJob(job);

    return NextResponse.json({
      generationId,
      status: "COMPLETED",
    });
  } catch (error) {
    console.error("Generation request failed:", error);
    await refundIfNeeded();

    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}
