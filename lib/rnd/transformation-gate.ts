import sharp from "sharp";

export type TransformationGateResult = {
  passed: boolean;
  noOp: boolean;
  meanAbsoluteDifference: number;
  changedPixelRatio: number;
  reason: string;
};

const SIZE = 192;
const CHANNEL_THRESHOLD = 3;
const NO_OP_MEAN_DIFF = 0.0025;
const NO_OP_CHANGED_RATIO = 0.005;

export async function runTransformationGate(
  sourceBuffer: Buffer,
  generatedBuffer: Buffer,
): Promise<TransformationGateResult> {
  const [source, generated] = await Promise.all([
    sharp(sourceBuffer)
      .removeAlpha()
      .resize(SIZE, SIZE, { fit: "fill", kernel: "nearest" })
      .raw()
      .toBuffer(),
    sharp(generatedBuffer)
      .removeAlpha()
      .resize(SIZE, SIZE, { fit: "fill", kernel: "nearest" })
      .raw()
      .toBuffer(),
  ]);

  if (source.length !== generated.length || source.length === 0) {
    return {
      passed: true,
      noOp: false,
      meanAbsoluteDifference: 1,
      changedPixelRatio: 1,
      reason: "Source and generated images could not be compared at the normalized pixel level.",
    };
  }

  let totalDifference = 0;
  let changedPixels = 0;
  const pixelCount = SIZE * SIZE;
  const channelCount = 3;

  for (let i = 0; i < source.length; i += channelCount) {
    let pixelDifference = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      pixelDifference += Math.abs(source[i + channel] - generated[i + channel]) / 255;
    }
    pixelDifference /= channelCount;
    totalDifference += pixelDifference;
    if (pixelDifference * 255 >= CHANNEL_THRESHOLD) changedPixels += 1;
  }

  const meanAbsoluteDifference = totalDifference / pixelCount;
  const changedPixelRatio = changedPixels / pixelCount;
  const noOp =
    meanAbsoluteDifference <= NO_OP_MEAN_DIFF &&
    changedPixelRatio <= NO_OP_CHANGED_RATIO;

  return {
    passed: !noOp,
    noOp,
    meanAbsoluteDifference,
    changedPixelRatio,
    reason: noOp
      ? "Generated image is effectively unchanged from the source at normalized pixel level; the requested transformation is not reliably present."
      : "Generated image contains a measurable visual change relative to the source.",
  };
}
