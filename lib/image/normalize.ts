import sharp from "sharp";

import { getImageMetadata } from "./metadata";
import { NormalizedImage } from "./types";

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
 * ✓ Preserve image dimensions
 * ✓ Determine Gemini aspect ratio
 */

export async function normalizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<NormalizedImage> {
  const normalizedBuffer = await sharp(buffer)
    .rotate()
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