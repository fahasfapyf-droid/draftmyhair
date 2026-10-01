import crypto from "node:crypto";

/**
 * ============================================================
 * Draft My Hair — Internal Access
 * ============================================================
 *
 * Server-only authentication for the internal optimizer endpoints.
 *
 * Security model:
 *  - Token is read from process.env.DMH_INTERNAL_TOKEN (server-only env).
 *  - It is NEVER referenced with a NEXT_PUBLIC_* prefix and never imported
 *    from client bundles: it exists only inside server route modules and
 *    this helper.
 *  - Comparison uses crypto.timingSafeEqual (constant-time) so a token
 *    mismatch cannot be used as a timing oracle.
 *  - The token is never returned or logged; error responses carry only a
 *    generic message.
 */

export class InternalAccessError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "InternalAccessError";
    this.status = status;
  }
}

export function internalTokenMatches(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) {
    return false;
  }

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Validates the Authorization header for internal optimizer routes.
 * Throws InternalAccessError with a status that the route maps to a
 * JSON response. No token value ever leaves this module.
 */
export function requireInternalAccess(
  authorization: string | null | undefined,
): void {
  const expected = process.env.DMH_INTERNAL_TOKEN;

  if (!expected) {
    throw new InternalAccessError(
      "Internal optimizer endpoint is not configured.",
      503,
    );
  }

  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (!internalTokenMatches(token, expected)) {
    throw new InternalAccessError("Unauthorized.");
  }
}
