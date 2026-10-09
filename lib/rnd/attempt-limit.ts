export const MAX_RND_ATTEMPTS = 40;

/** Attempt numbers are 1-based; attempt 40 is allowed, attempt 41 is not. */
export function isRndAttemptAllowed(attemptNumber: number): boolean {
  return Number.isInteger(attemptNumber) && attemptNumber >= 1 && attemptNumber <= MAX_RND_ATTEMPTS;
}

/** Jobs at the ceiling must not be claimed again. */
export function isRndJobAtAttemptLimit(attemptCount: number): boolean {
  return !Number.isFinite(attemptCount) || attemptCount >= MAX_RND_ATTEMPTS;
}

/** A report must match the next 1-based attempt before any limit transition is considered. */
export function isExpectedRndAttempt(attemptNumber: number, attemptCount: number): boolean {
  return Number.isInteger(attemptNumber) && Number.isInteger(attemptCount) && attemptNumber === attemptCount + 1;
}
