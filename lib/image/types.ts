/**
 * ============================================================
 * Draft My Hair
 * Image Processing Types
 * ============================================================
 */

export type SupportedAspectRatio =
  | "1:1"
  | "3:4"
  | "4:3"
  | "9:16"
  | "16:9";

export interface SourceImageMetadata {
  /**
   * Image width in pixels.
   */
  width: number;

  /**
   * Image height in pixels.
   */
  height: number;

  /**
   * Original EXIF orientation.
   *
   * Undefined if the image contains no
   * orientation metadata.
   */
  orientation?: number;

  /**
   * Closest Gemini-supported aspect ratio.
   */
  aspectRatio: SupportedAspectRatio;
}

export interface NormalizedImage {
  /**
   * EXIF-normalized image buffer.
   */
  buffer: Buffer;

  /**
   * MIME type.
   */
  mimeType: string;

  /**
   * Final width after normalization.
   */
  width: number;

  /**
   * Final height after normalization.
   */
  height: number;

  /**
   * Gemini-supported aspect ratio.
   */
  aspectRatio: SupportedAspectRatio;
}