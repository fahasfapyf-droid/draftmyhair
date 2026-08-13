ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "generationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Feedback_generationId_key" ON "Feedback"("generationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Feedback_generationId_fkey'
  ) THEN
    ALTER TABLE "Feedback"
    ADD CONSTRAINT "Feedback_generationId_fkey"
    FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
