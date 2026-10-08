import sharp from "sharp";

export type RndImageIntegrityResult = {
  canvasMatch: boolean;
  sourceWidth: number;
  sourceHeight: number;
  generatedWidth: number;
  generatedHeight: number;
  faceRegionDrift: number;
  faceRegionWarning: boolean;
};

const FACE_REGION = {
  left: 0.22,
  top: 0.30,
  width: 0.56,
  height: 0.48,
};

export async function runRndImageIntegrityCheck(
  sourceBuffer: Buffer,
  generatedBuffer: Buffer,
): Promise<RndImageIntegrityResult> {
  const [sourceMeta, generatedMeta] = await Promise.all([
    sharp(sourceBuffer).metadata(),
    sharp(generatedBuffer).metadata(),
  ]);

  const sourceWidth = sourceMeta.width ?? 0;
  const sourceHeight = sourceMeta.height ?? 0;
  const generatedWidth = generatedMeta.width ?? 0;
  const generatedHeight = generatedMeta.height ?? 0;

  if (!sourceWidth || !sourceHeight || !generatedWidth || !generatedHeight) {
    throw new Error("R&D image integrity check could not determine image dimensions.");
  }

  const canvasMatch = sourceWidth === generatedWidth && sourceHeight === generatedHeight;

  const size = 256;
  const sourceRaw = await sharp(sourceBuffer)
    .resize(size, size, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  const generatedRaw = await sharp(generatedBuffer)
    .resize(size, size, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  const left = Math.floor(size * FACE_REGION.left);
  const top = Math.floor(size * FACE_REGION.top);
  const width = Math.floor(size * FACE_REGION.width);
  const height = Math.floor(size * FACE_REGION.height);

  let total = 0;
  let count = 0;

  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const index = y * size + x;
      total += Math.abs(sourceRaw[index] - generatedRaw[index]) / 255;
      count += 1;
    }
  }

  const faceRegionDrift = count ? total / count : 1;

  return {
    canvasMatch,
    sourceWidth,
    sourceHeight,
    generatedWidth,
    generatedHeight,
    faceRegionDrift,
    // Advisory until calibrated against a representative corpus.
    faceRegionWarning: faceRegionDrift > 0.12,
  };
}
