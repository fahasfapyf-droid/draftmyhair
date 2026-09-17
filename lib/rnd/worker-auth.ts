import { timingSafeEqual } from "node:crypto";

export const RND_WORKER_PROTOCOL_VERSION = "1";
export const RND_WORKER_LEASE_SECONDS = 120;

function configuredToken() {
  return process.env.RND_WORKER_TOKEN?.trim() ?? "";
}

export function isRndWorkerAuthorized(authorization: string | null) {
  const expectedToken = configuredToken();
  if (!authorization?.startsWith("Bearer ") || !expectedToken) return false;

  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  if (supplied.length !== expected.length) return false;

  return timingSafeEqual(supplied, expected);
}

export function requireRndWorker(authorization: string | null): asserts authorization is string {
  if (isRndWorkerAuthorized(authorization)) return;
  throw new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
