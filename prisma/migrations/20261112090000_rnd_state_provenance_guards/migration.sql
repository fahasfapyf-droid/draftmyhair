-- Forward-only guard migration. Do not rewrite historical checksums or counters.
-- Invalid legacy NULL/negative data or multiple ACTIVE versions must be reviewed;
-- this transaction fails atomically rather than guessing a backfill or winner.
BEGIN;
ALTER TABLE "RnDAttempt" ALTER COLUMN "infrastructureRetryCount" SET DEFAULT 0;
ALTER TABLE "RnDAttempt" ALTER COLUMN "infrastructureRetryCount" SET NOT NULL;
ALTER TABLE "RnDJob" ALTER COLUMN "refinementCount" SET DEFAULT 0;
ALTER TABLE "RnDJob" ALTER COLUMN "refinementCount" SET NOT NULL;
ALTER TABLE "RnDJob" ADD CONSTRAINT "RnDJob_attempt_nonnegative_check" CHECK ("attemptCount" >= 0);
ALTER TABLE "RnDAttempt" ADD CONSTRAINT "RnDAttempt_retry_nonnegative_check" CHECK ("infrastructureRetryCount" >= 0);
-- New defaults must not grant a fresh allowance to an already-refined job.
-- Preserve larger historical counters; never reopen or change a job's status.
UPDATE "RnDJob" AS job SET "refinementCount" = GREATEST(job."refinementCount", 1)
WHERE job."promptVersionNumber" > 1 OR job."currentPrompt" LIKE '%# TARGETED REFINEMENT%'
   OR EXISTS (SELECT 1 FROM "RnDAttempt" AS attempt WHERE attempt."jobId" = job."id" AND attempt."refinementSlot" IS NOT NULL);
UPDATE "RnDJob" AS job SET "infrastructureRetryCount" = GREATEST(job."infrastructureRetryCount",
  (SELECT LEAST(COALESCE(SUM(attempt."infrastructureRetryCount"), 0), 2147483647)::integer FROM "RnDAttempt" AS attempt WHERE attempt."jobId" = job."id"));
CREATE UNIQUE INDEX "PromptVersion_one_active_per_style" ON "PromptVersion" ("hairstyleId") WHERE "status" = 'ACTIVE';
ALTER TABLE "PromptVersion" DROP CONSTRAINT "PromptVersion_sourceRnDAttemptId_fkey";
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_sourceRnDAttemptId_fkey"
  FOREIGN KEY ("sourceRnDAttemptId") REFERENCES "RnDAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
