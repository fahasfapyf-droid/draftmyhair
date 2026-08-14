ALTER TABLE "Feedback" ADD COLUMN "generationId" TEXT;

CREATE UNIQUE INDEX "Feedback_generationId_key" ON "Feedback"("generationId");

ALTER TABLE "Feedback"
ADD CONSTRAINT "Feedback_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
