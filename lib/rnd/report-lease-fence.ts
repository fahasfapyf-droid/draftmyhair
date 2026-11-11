type ReportFenceQuery = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type RndReportLeaseFence = {
  jobId: string;
  workerId: string;
  claimStartedAt: Date;
  expectedAttemptCount: number;
  attemptId: string;
  attemptNumber: number;
};

export function hasValidRndLeaseExpiry(value: unknown, now: Date): value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return false;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return false;
  return value.getTime() > now.getTime();
}

export function parseRndClaimGeneration(value: unknown) {
  if (typeof value !== "string") return null;
  const generation = new Date(value);
  if (Number.isNaN(generation.getTime()) || generation.toISOString() !== value) return null;
  return generation;
}

export function validateRndClaimGeneration(value: unknown, currentGeneration: Date | null) {
  const generation = parseRndClaimGeneration(value);
  if (!generation) return { status: "invalid" as const };
  if (!currentGeneration || generation.getTime() !== currentGeneration.getTime()) {
    return { status: "stale" as const };
  }
  return { status: "valid" as const, generation };
}

export async function fenceRndReportLease(tx: ReportFenceQuery, fence: RndReportLeaseFence) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE "RnDJob" AS job
    SET "heartbeatAt" = clock_timestamp()
    WHERE job."id" = ${fence.jobId}
      AND job."status" = 'PROCESSING'
      AND job."leaseOwner" = ${fence.workerId}
      AND job."leaseExpiresAt" > clock_timestamp()
      AND job."startedAt" = ${fence.claimStartedAt}
      AND job."attemptCount" = ${fence.expectedAttemptCount}
      AND EXISTS (
        SELECT 1
        FROM "RnDAttempt" AS attempt
        WHERE attempt."id" = ${fence.attemptId}
          AND attempt."jobId" = job."id"
          AND attempt."attemptNumber" = ${fence.attemptNumber}
      )
    RETURNING job."id"
  `;
  return rows.length === 1;
}
