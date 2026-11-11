export const ABSOLUTE_GENERATION_CEILING = 5;
export const MAX_INFRASTRUCTURE_RETRIES = 3;
export const MAX_TARGETED_REFINEMENTS = 1;
export function configuredGenerationBudget() {
  const value = process.env.RND_MAX_GENERATION_ATTEMPTS;
  if (value === undefined || value === "") return ABSOLUTE_GENERATION_CEILING;
  const limit = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(limit) || limit < 1 || limit > ABSOLUTE_GENERATION_CEILING) throw new Error("RND_INVALID_ATTEMPT_BUDGET");
  return limit;
}
export function generationBudget(stored?: number | null) {
  const value = stored ?? ABSOLUTE_GENERATION_CEILING;
  if (!Number.isInteger(value) || value < 1 || value > ABSOLUTE_GENERATION_CEILING) throw new Error("RND_INVALID_ATTEMPT_BUDGET");
  return Math.min(value, configuredGenerationBudget());
}
export function infrastructureRetryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|\b50[234]\b|resource exhausted|quota|rate.?limit|too many requests|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|temporarily unavailable/i.test(message);
}
export function infrastructureBackoff(count: number, random = Math.random) {
  const base = Math.min(600_000, 120_000 * 2 ** Math.max(0, Math.min(count - 1, 3)));
  return Math.min(600_000, Math.round(base * (0.8 + Math.max(0, Math.min(1, random())) * 0.4)));
}
