import { randomBytes, createHash } from "crypto";

/**
 * Number of bytes used to generate password reset tokens.
 *
 * 32 bytes = 256 bits of entropy.
 */
const RESET_TOKEN_BYTES = 32;

/**
 * Generates a cryptographically secure random password reset token.
 *
 * The returned value is URL-safe and can be included directly
 * in password reset links.
 */
export function generatePasswordResetToken(): string {
  return randomBytes(RESET_TOKEN_BYTES).toString("hex");
}

/**
 * Hashes a password reset token using SHA-256.
 *
 * Only the hash is stored in the database.
 * The raw token is sent to the user by email.
 */
export function hashPasswordResetToken(
  token: string
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

/**
 * Returns the expiration date for a password reset token.
 *
 * Default lifetime: 1 hour.
 */
export function createPasswordResetExpiry(
  hours = 1
): Date {
  const expiresAt = new Date();

  expiresAt.setHours(
    expiresAt.getHours() + hours
  );

  return expiresAt;
}