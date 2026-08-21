import { SupportedAspectRatio } from "./types";

/**
 * ============================================================
 * Draft My Hair
 * Aspect Ratio Detection
 * ============================================================
 *
 * Maps arbitrary image dimensions to the
 * closest Gemini-supported aspect ratio.
 */

type Ratio = {
  value: number;
  aspectRatio: SupportedAspectRatio;
};

const RATIOS: Ratio[] = [
  {
    value: 1,
    aspectRatio: "1:1",
  },
  {
    value: 3 / 4,
    aspectRatio: "3:4",
  },
  {
    value: 2 / 3,
    aspectRatio: "2:3",
  },
  {
    value: 4 / 3,
    aspectRatio: "4:3",
  },
  {
    value: 3 / 2,
    aspectRatio: "3:2",
  },
  {
    value: 9 / 16,
    aspectRatio: "9:16",
  },
  {
    value: 16 / 9,
    aspectRatio: "16:9",
  },
];

export function getAspectRatio(
  width: number,
  height: number
): SupportedAspectRatio {
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid image dimensions.");
  }

  const ratio = width / height;

  let closest = RATIOS[0];

  for (const candidate of RATIOS) {
    if (
      Math.abs(candidate.value - ratio) <
      Math.abs(closest.value - ratio)
    ) {
      closest = candidate;
    }
  }

  return closest.aspectRatio;
}
