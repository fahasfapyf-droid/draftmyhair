/**
 * ============================================================
 * Draft My Hair — Internal optimizer abuse protection
 * ============================================================
 *
 * Server-side, env-configurable limits for internal optimizer
 * generations (skipCredits=true bypasses customer credits, so these
 * gates are mandatory):
 *
 *   DMH_INTERNAL_MAX_PER_EXPERIMENT      max accepted generations per
 *                                        experiment id (default 200)
 *   DMH_INTERNAL_MAX_CONCURRENT          max in-flight optimizer
 *                                        generations (default 8)
 *   DMH_INTERNAL_RATE_LIMIT_PER_MINUTE   max accepted starts per 60s
 *                                        window (default 30)
 *
 * Testing environments set stricter values than production; every
 * value falls back to a safe default when missing or malformed. The
 * limiter FAILS CLOSED: any limit exceeded (or invalid identifier)
 * rejects the request with 4xx and never creates a generation.
 *
 * NOTE: counters are in-memory (per server instance). Per-experiment
 * counts are cumulative for the process lifetime; for multi-instance
 * production, back this with durable storage using the same decision
 * logic — the route behavior stays identical.
 */

export class InternalLimitsError extends Error {
  status: number;

  constructor(message: string, status = 429) {
    super(message);
    this.name = "InternalLimitsError";
    this.status = status;
  }
}

export type InternalLimitsConfig = {
  maxPerExperiment: number;
  maxConcurrent: number;
  rateLimitPerMinute: number;
};

export const EXPERIMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const MAX_EXPERIMENT_ID_LENGTH = 128;

/**
 * Validates (and trims) an experiment id for the optimizer generate
 * endpoint. Missing/malformed ids are rejected 400 BEFORE any limiter
 * state is touched — the endpoint fails closed.
 */
export function requireExperimentId(
  id: string | null | undefined
):
  | { ok: true; value: string }
  | { ok: false; status: number; reason: string } {
  if (!id || id.trim() === "") {
    return { ok: false, status: 400, reason: "experimentId is required." };
  }
  const value = id.trim();
  if (
    value.length > MAX_EXPERIMENT_ID_LENGTH ||
    !EXPERIMENT_ID_PATTERN.test(value)
  ) {
    return { ok: false, status: 400, reason: "Invalid experimentId." };
  }
  return { ok: true, value };
}

export function readInternalLimitsConfig(
  env: Record<string, string | undefined> = process.env
): InternalLimitsConfig {
  return {
    maxPerExperiment: positiveInt(env.DMH_INTERNAL_MAX_PER_EXPERIMENT, 200),
    maxConcurrent: positiveInt(env.DMH_INTERNAL_MAX_CONCURRENT, 8),
    rateLimitPerMinute: positiveInt(
      env.DMH_INTERNAL_RATE_LIMIT_PER_MINUTE,
      30
    ),
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export type StartDecision =
  | { ok: true }
  | { ok: false; status: number; reason: string };

/**
 * In-memory limiter. The route module holds the singleton
 * `internalOptimizerLimiter` (shared across requests on this instance);
 * tests construct fresh instances with stricter configs.
 */
export class InternalOptimizerLimiter {
  private readonly config: InternalLimitsConfig;
  private readonly active = new Set<string>();
  private readonly experimentCounts = new Map<string, number>();
  private windowStartedAt = Date.now();
  private windowCount = 0;

  constructor(config: InternalLimitsConfig = readInternalLimitsConfig()) {
    this.config = config;
  }

  tryStart(experimentId: string, generationId: string): StartDecision {
    // Fail closed on invalid identifiers (the parser usually rejects
    // these first, but never trust the boundary).
    if (!EXPERIMENT_ID_PATTERN.test(experimentId)) {
      return { ok: false, status: 400, reason: "Invalid experimentId." };
    }

    // Global rate limit — rolling 60s window of ACCEPTED starts.
    const now = Date.now();
    if (now - this.windowStartedAt > 60_000) {
      this.windowStartedAt = now;
      this.windowCount = 0;
    }
    if (this.windowCount >= this.config.rateLimitPerMinute) {
      return {
        ok: false,
        status: 429,
        reason: "Internal optimizer rate limit exceeded.",
      };
    }

    // Concurrency cap — in-flight optimizer generations.
    if (this.active.size >= this.config.maxConcurrent) {
      return {
        ok: false,
        status: 429,
        reason: "Too many concurrent internal generations.",
      };
    }

    // Per-experiment quota — cumulative for the process lifetime.
    const used = this.experimentCounts.get(experimentId) ?? 0;
    if (used >= this.config.maxPerExperiment) {
      return {
        ok: false,
        status: 429,
        reason: `Experiment generation quota exceeded (${this.config.maxPerExperiment}).`,
      };
    }

    this.experimentCounts.set(experimentId, used + 1);
    this.active.add(generationId);
    this.windowCount += 1;
    return { ok: true };
  }

  /** Releases the concurrency slot and rate-limit token for one generation. */
  finish(generationId: string): void {
    this.active.delete(generationId);
  }

  /** Test hook only. */
  reset(): void {
    this.active.clear();
    this.experimentCounts.clear();
    this.windowStartedAt = Date.now();
    this.windowCount = 0;
  }
}

/** Route-level singleton (per server instance). */
export const internalOptimizerLimiter = new InternalOptimizerLimiter();
