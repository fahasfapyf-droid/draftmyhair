import { timingSafeEqual } from "node:crypto";

export const RND_WORKER_PROTOCOL_VERSION = "1";
export const RND_WORKER_LEASE_SECONDS = 120;

function configuredToken() {
  const token = process.env.RND_WORKER_TOKEN?.trim();
  if (!token) {
    throw new Error("RND_WORKER_TOKEN is not configured");
  }
  return token;
}

export function isRndWorkerAuthorized(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(configuredToken(), "utf8");
  if (supplied.length !== expected.length) return false;

  return timingSafeEqual(supplied, expected);
}

export function requireRndWorker(authorization: string | null) {
  try {
    if (isRndWorkerAuthorized(authorization)) return;
  } catch {
    // Treat a missing worker token exactly like an unauthorized request.
  }
  throw new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
