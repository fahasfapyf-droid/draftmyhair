ALTER TABLE "PromptVersion"
  ADD COLUMN IF NOT EXISTS "sourceRnDAttemptId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_sourceRnDAttemptId_key"
  ON "PromptVersion"("sourceRnDAttemptId");

DO $$ BEGIN
  ALTER TABLE "PromptVersion"
    ADD CONSTRAINT "PromptVersion_sourceRnDAttemptId_fkey"
    FOREIGN KEY ("sourceRnDAttemptId")
    REFERENCES "RnDAttempt"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
