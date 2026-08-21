import sharp from "sharp";

import { getImageMetadata } from "./metadata";
import { NormalizedImage } from "./types";

const MAX_DIMENSION = 2048;

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
 * ✓ Cap longest side at MAX_DIMENSION (2048px)
 * ✓ Determine Gemini aspect ratio
 */

export async function normalizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<NormalizedImage> {
  const normalizedBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();

  const metadata = await getImageMetadata(
    normalizedBuffer
  );

  return {
    buffer: normalizedBuffer,
    mimeType,

    width: metadata.width,
    height: metadata.height,

    aspectRatio: metadata.aspectRatio,
  };
}
