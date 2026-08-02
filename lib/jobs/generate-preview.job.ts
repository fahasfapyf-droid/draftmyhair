import {
  executeGeneratePreviewJob,
  prepareGeneratePreviewJob,
} from "@/lib/services/generation-execution.service";
import type {
  GeneratePreviewJob,
  PrepareGeneratePreviewJobInput,
} from "@/lib/services/generation-execution.service";

export type {
  GeneratePreviewJob,
  GenerationExecutionResult,
  PrepareGeneratePreviewJobInput,
} from "@/lib/services/generation-execution.service";

export function createGeneratePreviewJob(
  input: PrepareGeneratePreviewJobInput
) {
  return prepareGeneratePreviewJob(input);
}

export function runGeneratePreviewJob(
  job: GeneratePreviewJob
) {
  return executeGeneratePreviewJob(job);
}
