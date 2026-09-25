import { timingSafeEqual } from "node:crypto";

export const RND_WORKER_PROTOCOL_VERSION = "1";
export const RND_WORKER_LEASE_SECONDS = 120;

function configuredToken() {
  return process.env.RND_WORKER_TOKEN?.trim() || null;
}

export function isRndWorkerAuthorized(authorization: string | null) {
  const token = configuredToken();
  if (!token || !authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(token, "utf8");
  if (supplied.length !== expected.length) return false;

  return timingSafeEqual(supplied, expected);
}

export function requireRndWorker(authorization: string | null, workerId?: string | null): Response | null {
  if (isRndWorkerAuthorized(authorization)) return null;

  // Preview-only lifecycle smoke testing. Production always requires the shared worker token.
  if (process.env.VERCEL_ENV === "preview" && workerId?.trim()) return null;

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
