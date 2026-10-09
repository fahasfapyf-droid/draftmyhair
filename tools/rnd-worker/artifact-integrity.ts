import { createHash } from "node:crypto";

export function attemptArtifactFilename(jobId: string, attemptNumber: number): string {
  if (!jobId.trim()) throw new Error("jobId is required for attempt artifact association.");
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error("attemptNumber must be a positive integer.");
  }
  return `${jobId}-attempt-${attemptNumber}.png`;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
