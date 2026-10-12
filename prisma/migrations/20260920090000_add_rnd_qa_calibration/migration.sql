-- Human reference ratings for blind R&D QA calibration.
CREATE TABLE "RnDQAReferenceRating" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "reviewerKey" TEXT NOT NULL,
  "humanOverallScore" DECIMAL(4,2) NOT NULL,
  "humanHairstyleScore" DECIMAL(4,2),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RnDQAReferenceRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RnDQAReferenceRating_attemptId_reviewerKey_key"
  ON "RnDQAReferenceRating"("attemptId", "reviewerKey");

CREATE INDEX "RnDQAReferenceRating_attemptId_idx"
  ON "RnDQAReferenceRating"("attemptId");

CREATE INDEX "RnDQAReferenceRating_createdAt_idx"
  ON "RnDQAReferenceRating"("createdAt");

ALTER TABLE "RnDQAReferenceRating"
  ADD CONSTRAINT "RnDQAReferenceRating_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "RnDAttempt"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
