BEGIN;

CREATE TABLE "RnDQAReviewReceipt" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "promptChecksum" TEXT NOT NULL,
  "artifactChecksum" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RnDQAReviewReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RnDQAReviewReceipt_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "RnDAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RnDQAReviewReceipt_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RnDQAReviewReceipt_hash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$' AND "promptChecksum" ~ '^[a-f0-9]{64}$' AND "artifactChecksum" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "RnDQAReviewReceipt_tokenHash_key" ON "RnDQAReviewReceipt"("tokenHash");
CREATE INDEX "RnDQAReviewReceipt_attemptId_reviewerId_expiresAt_idx" ON "RnDQAReviewReceipt"("attemptId", "reviewerId", "expiresAt");
CREATE INDEX "RnDQAReviewReceipt_expiresAt_idx" ON "RnDQAReviewReceipt"("expiresAt");

-- A disposable-test-only cleanup role is provisioned by the local test harness,
-- not by this application migration. Production migration accounts therefore
-- do not need CREATEROLE, and absence of the role grants no DELETE capability.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'dmh_calibration_cleanup'
      AND NOT rolcanlogin AND NOT rolinherit AND NOT rolbypassrls AND NOT rolsuper
  ) THEN
    EXECUTE 'GRANT DELETE ON "RnDPromptCalibration" TO dmh_calibration_cleanup';
    EXECUTE 'GRANT DELETE ON "RnDQAReferenceRating" TO dmh_calibration_cleanup';
    EXECUTE 'GRANT SELECT ("id", "attemptId") ON "RnDQAReferenceRating" TO dmh_calibration_cleanup';
    EXECUTE 'GRANT SELECT ("promptVersionId") ON "RnDPromptCalibration" TO dmh_calibration_cleanup';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS "RnDPromptCalibration_immutable" ON "RnDPromptCalibration";
CREATE OR REPLACE FUNCTION "rnd_calibration_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'dmh_calibration_cleanup'
     AND current_database() ~ '^dmh71_review_[0-9a-f]{16}$'
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND NOT rolcanlogin AND NOT rolinherit AND NOT rolbypassrls AND NOT rolsuper) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Calibration executions are immutable; complete a new execution.' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "RnDPromptCalibration_immutable"
  BEFORE UPDATE OR DELETE ON "RnDPromptCalibration"
  FOR EACH ROW EXECUTE FUNCTION "rnd_calibration_immutable"();

COMMIT;
