export const RND_WORKER_ISOLATED_JOB_ID_HEADER = "x-rnd-worker-job-id";

export type RndWorkerClaimPolicy =
  | { ok: true; jobId: string | null }
  | { ok: false; status: 409 | 503; code: string };

/**
 * Resolve the server-side single-job allowlist against the worker's explicit
 * request. A configured allowlist always requires an exact matching header.
 * A worker cannot enable isolation by supplying a header when the server has
 * not independently configured the same job ID.
 */
export function resolveRndWorkerClaimJobId(
  configuredJobId: string | undefined,
  requestedJobId: string | null,
): RndWorkerClaimPolicy {
  if (configuredJobId === undefined) {
    return requestedJobId === null
      ? { ok: true, jobId: null }
      : { ok: false, status: 503, code: "RND_WORKER_ISOLATION_NOT_CONFIGURED" };
  }

  const jobId = configuredJobId.trim();
  if (!jobId || jobId.length > 191 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(jobId)) {
    return { ok: false, status: 503, code: "RND_WORKER_ISOLATION_CONFIG_INVALID" };
  }

  if (requestedJobId?.trim() !== jobId) {
    return { ok: false, status: 409, code: "RND_WORKER_ISOLATION_JOB_ID_MISMATCH" };
  }

  return { ok: true, jobId };
}