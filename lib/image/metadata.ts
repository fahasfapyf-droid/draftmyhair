import sharp from "sharp";

import { getAspectRatio } from "./aspect-ratio";
import { SourceImageMetadata } from "./types";

/**
 * ============================================================
 * Draft My Hair
 * Image Metadata
 * ============================================================
 *
 * Reads source image metadata without
 * modifying the original image.
 */

export async function getImageMetadata(
  buffer: Buffer
): Promise<SourceImageMetadata> {
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(
      "Unable to determine image dimensions."
    );
  }

  return {
    width: metadata.width,
    height: metadata.height,
    orientation: metadata.orientation,
    aspectRatio: getAspectRatio(
      metadata.width,
      metadata.height
    ),
  };
}