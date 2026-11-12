BEGIN;
-- Legacy ratings/status strings are NOT retroactively certified.
ALTER TABLE "RnDQAReferenceRating" ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3), ADD COLUMN "promptChecksum" TEXT,
  ADD COLUMN "artifactChecksum" TEXT;
ALTER TABLE "RnDQAReferenceRating" ADD CONSTRAINT "RnDQAReferenceRating_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "RnDQAReferenceRating_attemptId_reviewedByUserId_key" ON "RnDQAReferenceRating"("attemptId","reviewedByUserId");
CREATE UNIQUE INDEX "PromptVersion_id_hairstyleId_key" ON "PromptVersion"("id","hairstyleId");
CREATE TABLE "RnDPromptCalibration" (
  "id" BIGSERIAL PRIMARY KEY, "promptVersionId" TEXT NOT NULL,
  "hairstyleId" TEXT NOT NULL, "promptChecksum" TEXT NOT NULL,
  "sourceAttemptId" TEXT NOT NULL, "result" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "executedByUserId" TEXT NOT NULL, "policyVersion" TEXT NOT NULL,
  "evidenceDigest" TEXT NOT NULL, "summary" JSONB NOT NULL,
  CONSTRAINT "RnDPromptCalibration_promptVersionId_hairstyleId_fkey" FOREIGN KEY ("promptVersionId","hairstyleId") REFERENCES "PromptVersion"("id","hairstyleId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RnDPromptCalibration_executedByUserId_fkey" FOREIGN KEY ("executedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RnDPromptCalibration_result_check" CHECK ("result" IN ('PASSED','FAILED','INCOMPLETE')),
  CONSTRAINT "RnDPromptCalibration_hash_check" CHECK ("promptChecksum" ~ '^[a-f0-9]{64}$' AND "evidenceDigest" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "RnDPromptCalibration_promptVersionId_id_idx" ON "RnDPromptCalibration"("promptVersionId","id");
CREATE FUNCTION "rnd_calibration_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Calibration executions are immutable; complete a new execution.' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER "RnDPromptCalibration_immutable" BEFORE UPDATE ON "RnDPromptCalibration" FOR EACH ROW EXECUTE FUNCTION "rnd_calibration_immutable"();
COMMIT;
