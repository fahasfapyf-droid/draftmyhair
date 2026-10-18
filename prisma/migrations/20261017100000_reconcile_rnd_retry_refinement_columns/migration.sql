-- Reconcile the Prisma schema with the isolated R&D database contract.
-- Existing preview databases may already have these columns from migrations
-- that are missing from this checkout; IF NOT EXISTS keeps this additive repair safe.
ALTER TABLE "RnDAttempt"
  ADD COLUMN IF NOT EXISTS "infrastructureRetryCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RnDJob"
  ADD COLUMN IF NOT EXISTS "refinementCount" INTEGER NOT NULL DEFAULT 0;
