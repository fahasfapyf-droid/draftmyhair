import { prisma } from "@/lib/prisma";
import {
  DecisionConfidence,
  Feedback,
  FeedbackIssue,
} from "@prisma/client";

export interface CreateFeedbackInput {
  generationId: string;
  hairstyleId: string;
  overallRating: number;
  identityRating: number;
  realismRating: number;
  decisionConfidence: DecisionConfidence;
  issues: FeedbackIssue[];
  comment?: string;
}

export interface FeedbackValidationFailure {
  valid: false;
  errors: string[];
}

export interface FeedbackValidationSuccess {
  valid: true;
  data: CreateFeedbackInput;
}

export type FeedbackValidationResult =
  | FeedbackValidationFailure
  | FeedbackValidationSuccess;

export type CreateFeedbackResult =
  | { created: true; feedback: Feedback }
  | { created: false };

const decisionConfidenceValues = new Set<DecisionConfidence>(Object.values(DecisionConfidence));
const feedbackIssueValues = new Set<FeedbackIssue>(Object.values(FeedbackIssue));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function validateFeedbackInput(value: unknown): FeedbackValidationResult {
  if (!isRecord(value)) return { valid: false, errors: ["Request body must be a JSON object."] };

  const errors: string[] = [];
  const generationId = value.generationId;
  const hairstyleId = value.hairstyleId;
  const overallRating = value.overallRating;
  const identityRating = value.identityRating;
  const realismRating = value.realismRating;
  const decisionConfidence = value.decisionConfidence;
  const issues = value.issues;
  const comment = value.comment;

  if (typeof generationId !== "string" || generationId.trim().length === 0) errors.push("generationId is required.");
  if (typeof hairstyleId !== "string" || hairstyleId.trim().length === 0) errors.push("hairstyleId is required.");
  if (!isRating(overallRating)) errors.push("overallRating must be an integer from 1 to 5.");
  if (!isRating(identityRating)) errors.push("identityRating must be an integer from 1 to 5.");
  if (!isRating(realismRating)) errors.push("realismRating must be an integer from 1 to 5.");
  if (typeof decisionConfidence !== "string" || !decisionConfidenceValues.has(decisionConfidence as DecisionConfidence)) {
    errors.push("decisionConfidence is invalid.");
  }
  if (issues !== undefined && (!Array.isArray(issues) || !issues.every((issue) => typeof issue === "string" && feedbackIssueValues.has(issue as FeedbackIssue)))) {
    errors.push("issues must contain valid feedback issue values.");
  }
  if (typeof comment !== "undefined" && typeof comment !== "string") errors.push("comment must be a string.");
  if (typeof comment === "string" && comment.length > 500) errors.push("comment must be 500 characters or fewer.");

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      generationId: (generationId as string).trim(),
      hairstyleId: (hairstyleId as string).trim(),
      overallRating: overallRating as number,
      identityRating: identityRating as number,
      realismRating: realismRating as number,
      decisionConfidence: decisionConfidence as DecisionConfidence,
      issues: (issues ?? []) as FeedbackIssue[],
      comment: typeof comment === "string" ? comment.trim() || undefined : undefined,
    },
  };
}

export async function createFeedback(input: CreateFeedbackInput, userId: string): Promise<CreateFeedbackResult> {
  const generation = await prisma.generation.findFirst({
    where: {
      id: input.generationId,
      userId,
      hairstyleId: input.hairstyleId,
      status: "COMPLETED",
    },
    select: { id: true },
  });

  if (!generation) return { created: false };

  const feedback = await prisma.feedback.create({
    data: {
      userId,
      hairstyleId: input.hairstyleId,
      generationId: generation.id,
      overallRating: input.overallRating,
      identityRating: input.identityRating,
      realismRating: input.realismRating,
      decisionConfidence: input.decisionConfidence,
      issues: input.issues,
      comment: input.comment,
    },
  });

  return { created: true, feedback };
}
