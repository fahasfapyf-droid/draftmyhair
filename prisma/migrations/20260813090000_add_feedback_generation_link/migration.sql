-- Add a nullable generation link so legacy feedback remains intact.
ALTER TABLE "Feedback"
ADD COLUMN "generationId" TEXT;

-- A generation can be reviewed at most once.
CREATE UNIQUE INDEX "Feedback_generationId_key" ON "Feedback"("generationId");

-- Preserve the exact generation that produced the reviewed hairstyle.
ALTER TABLE "Feedback"
ADD CONSTRAINT "Feedback_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "Generation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
