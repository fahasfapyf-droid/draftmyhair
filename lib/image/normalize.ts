import sharp from "sharp";

import { getImageMetadata } from "./metadata";
import { NormalizedImage } from "./types";

const MAX_GENERATION_DIMENSION = 2048;

/**
 * ============================================================
 * Draft My Hair
 * Image Normalization
 * ============================================================
 *
 * Responsibilities
 *
 * ✓ Normalize EXIF orientation
 * ✓ Remove EXIF orientation flag
 * ✓ Preserve image quality
 * ✓ Prevent excessively large source dimensions from reaching Vertex
 * ✓ Determine Gemini aspect ratio
 */

export async function normalizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<NormalizedImage> {
  const source = sharp(buffer).rotate();
  const sourceMetadata = await source.metadata();

  const width = sourceMetadata.width ?? 0;
  const height = sourceMetadata.height ?? 0;
  const needsResize =
    width > MAX_GENERATION_DIMENSION || height > MAX_GENERATION_DIMENSION;

  let normalizedImage = source;

  if (needsResize) {
    normalizedImage = source.resize({
      width: MAX_GENERATION_DIMENSION,
      height: MAX_GENERATION_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const normalizedBuffer = await normalizedImage.toBuffer();

  const metadata = await getImageMetadata(normalizedBuffer);

  return {
    buffer: normalizedBuffer,
    mimeType,

    width: metadata.width,
    height: metadata.height,

    aspectRatio: metadata.aspectRatio,
  };
}
