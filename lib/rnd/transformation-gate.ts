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

// A global pixel diff can be inflated by JPEG/WebP encoding, antialiasing,
// lighting normalization, or a regenerated background even when the hairstyle
// itself was not changed. Use perceptual structure as a second, independent
// no-op signal.
const PERCEPTUAL_SIZE = 32;
const NEAR_IDENTICAL_DHASH_BITS = 10;
const NEAR_IDENTICAL_AHASH_BITS = 10;
const NEAR_IDENTICAL_MEAN_DIFF = 0.12;

function hammingDistance(a: Uint8Array, b: Uint8Array) {
  let distance = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    let value = a[i] ^ b[i];
    while (value) {
      value &= value - 1;
      distance += 1;
    }
  }
  return distance + Math.abs(a.length - b.length) * 8;
}

async function perceptualHashes(buffer: Buffer) {
  const [gray, color] = await Promise.all([
    sharp(buffer)
      .removeAlpha()
      .resize(PERCEPTUAL_SIZE + 1, PERCEPTUAL_SIZE, { fit: "fill", kernel: "lanczos3" })
      .greyscale()
      .raw()
      .toBuffer(),
    sharp(buffer)
      .removeAlpha()
      .resize(PERCEPTUAL_SIZE, PERCEPTUAL_SIZE, { fit: "fill", kernel: "lanczos3" })
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  const dHash = new Uint8Array(Math.ceil((PERCEPTUAL_SIZE * PERCEPTUAL_SIZE) / 8));
  const aHash = new Uint8Array(Math.ceil((PERCEPTUAL_SIZE * PERCEPTUAL_SIZE) / 8));

  let dIndex = 0;
  let dBit = 0;
  let aIndex = 0;
  let aBit = 0;

  let sum = 0;
  for (const value of color) sum += value;
  const average = sum / color.length;

  for (let y = 0; y < PERCEPTUAL_SIZE; y += 1) {
    for (let x = 0; x < PERCEPTUAL_SIZE; x += 1) {
      const left = gray[y * (PERCEPTUAL_SIZE + 1) + x];
      const right = gray[y * (PERCEPTUAL_SIZE + 1) + x + 1];
      if (left > right) dHash[dIndex] |= 1 << dBit;
      dBit += 1;
      if (dBit === 8) {
        dBit = 0;
        dIndex += 1;
      }

      if (color[y * PERCEPTUAL_SIZE + x] >= average) aHash[aIndex] |= 1 << aBit;
      aBit += 1;
      if (aBit === 8) {
        aBit = 0;
        aIndex += 1;
      }
    }
  }

  return { dHash, aHash };
}

export async function runTransformationGate(
  sourceBuffer: Buffer,
  generatedBuffer: Buffer,
): Promise<TransformationGateResult> {
  const [source, generated, sourceHashes, generatedHashes] = await Promise.all([
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
    perceptualHashes(sourceBuffer),
    perceptualHashes(generatedBuffer),
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
  const dHashDistance = hammingDistance(sourceHashes.dHash, generatedHashes.dHash);
  const aHashDistance = hammingDistance(sourceHashes.aHash, generatedHashes.aHash);

  const pixelNoOp =
    meanAbsoluteDifference <= NO_OP_MEAN_DIFF &&
    changedPixelRatio <= NO_OP_CHANGED_RATIO;

  const perceptualNoOp =
    dHashDistance <= NEAR_IDENTICAL_DHASH_BITS &&
    aHashDistance <= NEAR_IDENTICAL_AHASH_BITS &&
    meanAbsoluteDifference <= NEAR_IDENTICAL_MEAN_DIFF;

  const noOp = pixelNoOp || perceptualNoOp;

  return {
    passed: !noOp,
    noOp,
    meanAbsoluteDifference,
    changedPixelRatio,
    reason: noOp
      ? pixelNoOp
        ? "Generated image is effectively unchanged from the source at normalized pixel level; the requested transformation is not reliably present."
        : "Generated image is perceptually near-identical to the source despite measurable pixel differences; the requested transformation is not reliably present."
      : "Generated image contains a meaningful visual change relative to the source.",
  };
}
