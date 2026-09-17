-- CreateEnum
CREATE TYPE "RnDCampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RnDTargetType" AS ENUM ('SINGLE', 'COMPOSITE', 'PARALLEL');

-- CreateEnum
CREATE TYPE "RnDTargetStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'QA', 'HUMAN_APPROVAL', 'APPROVED', 'REJECTED', 'EXHAUSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "RnDAssetKind" AS ENUM ('SOURCE', 'GENERATED');

-- CreateEnum
CREATE TYPE "RnDJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'QA', 'HUMAN_APPROVAL', 'COMPLETED', 'REFINING', 'EXHAUSTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RnDAttemptVerdict" AS ENUM ('REFINE', 'HUMAN_APPROVAL', 'APPROVED', 'EXHAUSTED', 'FAILED');

-- CreateTable
CREATE TABLE "RnDCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RnDCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "autoAdvanceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RnDCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnDTarget" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "targetType" "RnDTargetType" NOT NULL DEFAULT 'SINGLE',
    "targetKey" TEXT NOT NULL,
    "hairstyleId" TEXT,
    "hairColorKey" TEXT,
    "beardKey" TEXT,
    "hardCoreInstruction" TEXT,
    "sourceAssetId" TEXT NOT NULL,
    "currentJobId" TEXT,
    "status" "RnDTargetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RnDTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnDAsset" (
    "id" TEXT NOT NULL,
    "kind" "RnDAssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RnDAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnDJob" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "RnDJobStatus" NOT NULL DEFAULT 'QUEUED',
    "promptVersionNumber" INTEGER NOT NULL,
    "currentPrompt" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    CONSTRAINT "RnDJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RnDAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptRevision" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationStartedAt" TIMESTAMP(3),
    "generationCompletedAt" TIMESTAMP(3),
    "artifactId" TEXT,
    "qaJson" JSONB,
    "overallScore" DECIMAL(4,2),
    "aiGatePassed" BOOLEAN,
    "publicationTierPassed" BOOLEAN,
    "verdict" "RnDAttemptVerdict" NOT NULL,
    "refinementSlot" TEXT,
    "refinementReason" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    CONSTRAINT "RnDAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RnDCampaign_status_idx" ON "RnDCampaign"("status");
CREATE INDEX "RnDCampaign_createdAt_idx" ON "RnDCampaign"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RnDTarget_campaignId_targetKey_key" ON "RnDTarget"("campaignId", "targetKey");
CREATE INDEX "RnDTarget_campaignId_status_idx" ON "RnDTarget"("campaignId", "status");
CREATE INDEX "RnDTarget_sourceAssetId_idx" ON "RnDTarget"("sourceAssetId");
CREATE INDEX "RnDTarget_status_idx" ON "RnDTarget"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RnDAsset_storageKey_key" ON "RnDAsset"("storageKey");
CREATE UNIQUE INDEX "RnDAsset_blobUrl_key" ON "RnDAsset"("blobUrl");
CREATE INDEX "RnDAsset_kind_idx" ON "RnDAsset"("kind");
CREATE INDEX "RnDAsset_checksum_idx" ON "RnDAsset"("checksum");

-- CreateIndex
CREATE INDEX "RnDJob_status_queuedAt_idx" ON "RnDJob"("status", "queuedAt");
CREATE INDEX "RnDJob_leaseExpiresAt_idx" ON "RnDJob"("leaseExpiresAt");
CREATE INDEX "RnDJob_targetId_idx" ON "RnDJob"("targetId");
CREATE INDEX "RnDJob_leaseOwner_idx" ON "RnDJob"("leaseOwner");

-- CreateIndex
CREATE UNIQUE INDEX "RnDAttempt_jobId_attemptNumber_key" ON "RnDAttempt"("jobId", "attemptNumber");
CREATE INDEX "RnDAttempt_jobId_submittedAt_idx" ON "RnDAttempt"("jobId", "submittedAt");
CREATE INDEX "RnDAttempt_verdict_idx" ON "RnDAttempt"("verdict");
CREATE INDEX "RnDAttempt_aiGatePassed_idx" ON "RnDAttempt"("aiGatePassed");
CREATE INDEX "RnDAttempt_publicationTierPassed_idx" ON "RnDAttempt"("publicationTierPassed");

-- AddForeignKey
ALTER TABLE "RnDTarget" ADD CONSTRAINT "RnDTarget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RnDCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnDTarget" ADD CONSTRAINT "RnDTarget_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "RnDAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnDJob" ADD CONSTRAINT "RnDJob_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "RnDTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnDAttempt" ADD CONSTRAINT "RnDAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RnDJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RnDAttempt" ADD CONSTRAINT "RnDAttempt_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "RnDAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
