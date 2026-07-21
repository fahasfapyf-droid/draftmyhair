-- CreateEnum
CREATE TYPE "DecisionConfidence" AS ENUM ('YES', 'MAYBE', 'NO');

-- CreateEnum
CREATE TYPE "FeedbackIssue" AS ENUM ('IDENTITY', 'WRONG_STYLE', 'TOO_LONG', 'TOO_SHORT', 'WRONG_COLOR', 'ARTIFICIAL_TEXTURE', 'HAIR_DENSITY', 'HAIRLINE', 'NOT_REALISTIC', 'LIGHTING', 'BACKGROUND', 'OTHER');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "hairstyleId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "identityRating" INTEGER NOT NULL,
    "decisionConfidence" "DecisionConfidence" NOT NULL,
    "issues" "FeedbackIssue"[],
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_hairstyleId_idx" ON "Feedback"("hairstyleId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_decisionConfidence_idx" ON "Feedback"("decisionConfidence");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_hairstyleId_fkey" FOREIGN KEY ("hairstyleId") REFERENCES "Hairstyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
