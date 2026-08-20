"use client";

const MAX_GENERATION_DIMENSION = 2048;
const MAX_GENERATION_BYTES = 3.5 * 1024 * 1024;
const JPEG_QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62];

type SourceDimensions = {
  width: number;
  height: number;
};

function getTargetDimensions({ width, height }: SourceDimensions) {
  const longestSide = Math.max(width, height);

  if (longestSide <= MAX_GENERATION_DIMENSION) {
    return { width, height };
  }

  const scale = MAX_GENERATION_DIMENSION / longestSide;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to prepare the uploaded image."));
    };

    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to prepare the uploaded image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Prepare an image before it crosses Vercel's request-size boundary.
 *
 * Files already below the safe payload threshold and working resolution
 * are returned unchanged. Larger files are proportionally resized and/or
 * JPEG-compressed in the browser so the server receives a safe payload.
 */
export async function prepareGenerationImage(file: File): Promise<File> {
  if (file.size <= MAX_GENERATION_BYTES) {
    return file;
  }

  const image = await loadImage(file);
  const { width, height } = getTargetDimensions({
    width: image.naturalWidth,
    height: image.naturalHeight,
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare the uploaded image.");
  }

  context.drawImage(image, 0, 0, width, height);

  for (const quality of JPEG_QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality);

    if (blob.size <= MAX_GENERATION_BYTES) {
      return new File([blob], "generation-source.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
  }

  throw new Error(
    "This image is too large to process safely. Please choose a smaller image."
  );
}
