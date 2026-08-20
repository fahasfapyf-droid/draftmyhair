"use client";

const MAX_GENERATION_DIMENSION = 2048;
const MAX_GENERATION_BYTES = 3.5 * 1024 * 1024;
const PRIMARY_JPEG_QUALITY = 0.82;
const FALLBACK_JPEG_QUALITY = 0.68;

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
 * Files already below the safe payload threshold are returned unchanged.
 * Larger files are resized to the controlled working resolution and encoded
 * once at the primary quality. A single lower-quality fallback is used only
 * when the first encoded payload is still above the safe threshold.
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

  const primaryBlob = await canvasToBlob(canvas, PRIMARY_JPEG_QUALITY);

  if (primaryBlob.size <= MAX_GENERATION_BYTES) {
    return new File([primaryBlob], "generation-source.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  const fallbackBlob = await canvasToBlob(canvas, FALLBACK_JPEG_QUALITY);

  if (fallbackBlob.size <= MAX_GENERATION_BYTES) {
    return new File([fallbackBlob], "generation-source.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  throw new Error(
    "This image is too large to process safely. Please choose a smaller image."
  );
}
