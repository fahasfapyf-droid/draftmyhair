-- Reconcile indexes in the initial migration with the current Prisma schema.
DROP INDEX IF EXISTS "Feedback_createdAt_idx";
DROP INDEX IF EXISTS "VerificationToken_expires_idx";
CREATE INDEX IF NOT EXISTS "VerificationToken_identifier_idx" ON "VerificationToken"("identifier");