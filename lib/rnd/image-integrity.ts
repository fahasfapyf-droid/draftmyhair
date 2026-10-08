import sharp from "sharp";

export type RndImageIntegrityResult = {
  canvasMatch: boolean;
  sourceWidth: number;
  sourceHeight: number;
  generatedWidth: number;
  generatedHeight: number;
  faceRegionDrift: number;
  faceRegionWarning: boolean;
  faceTextureRatio: number;
  faceTexturePreservationPass: boolean;
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

  const sourceAspect = sourceWidth / sourceHeight;
  const generatedAspect = generatedWidth / generatedHeight;
  const aspectRatioDelta = Math.abs(sourceAspect - generatedAspect) / sourceAspect;
  const minimumGeneratedDimension = Math.min(generatedWidth, generatedHeight);

  // Gemini may return the same registered frame at a lower pixel resolution.
  // Exact pixel dimensions are not a framing invariant; aspect ratio plus a
  // minimum usable resolution is the conservative deterministic gate.
  const canvasMatch =
    minimumGeneratedDimension >= 512 &&
    aspectRatioDelta <= 0.01;

  const size = 512;
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

  // Deterministic texture-preservation check for the locked face region.
  // A simple luminance-drift metric can miss smoothing of freckles/pores when
  // the broad facial luminance remains similar. Measure high-frequency skin
  // detail in a conservative inner-face crop that excludes most hair, ears,
  // and the outer jaw boundary. The ratio is scale-invariant and therefore
  // remains useful when Gemini returns the registered frame at lower resolution.
  const textureSize = 512;
  const sourceGray = await sharp(sourceBuffer)
    .resize(textureSize, textureSize, { fit: "fill" })
    .grayscale()
    .blur(1.2)
    .raw()
    .toBuffer();
  const generatedGray = await sharp(generatedBuffer)
    .resize(textureSize, textureSize, { fit: "fill" })
    .grayscale()
    .blur(1.2)
    .raw()
    .toBuffer();
  const sourceFine = await sharp(sourceBuffer)
    .resize(textureSize, textureSize, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();
  const generatedFine = await sharp(generatedBuffer)
    .resize(textureSize, textureSize, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  const skinLeft = Math.floor(textureSize * 0.30);
  const skinTop = Math.floor(textureSize * 0.39);
  const skinWidth = Math.floor(textureSize * 0.40);
  const skinHeight = Math.floor(textureSize * 0.27);
  let sourceTexture = 0;
  let generatedTexture = 0;
  let textureCount = 0;
  for (let y = skinTop; y < skinTop + skinHeight; y += 1) {
    for (let x = skinLeft; x < skinLeft + skinWidth; x += 1) {
      const index = y * textureSize + x;
      sourceTexture += Math.abs(sourceFine[index] - sourceGray[index]);
      generatedTexture += Math.abs(generatedFine[index] - generatedGray[index]);
      textureCount += 1;
    }
  }
  const sourceTextureMean = textureCount ? sourceTexture / textureCount : 0;
  const generatedTextureMean = textureCount ? generatedTexture / textureCount : 0;
  const faceTextureRatio = sourceTextureMean > 0
    ? generatedTextureMean / sourceTextureMean
    : 1;
  const faceTexturePreservationPass =
    faceRegionDrift <= 0.08 &&
    faceTextureRatio >= 0.75 &&
    faceTextureRatio <= 1.30;

  return {
    canvasMatch,
    sourceWidth,
    sourceHeight,
    generatedWidth,
    generatedHeight,
    faceRegionDrift,
    faceTextureRatio,
    faceTexturePreservationPass,
    faceRegionWarning: faceRegionDrift > 0.12,
  };
}
