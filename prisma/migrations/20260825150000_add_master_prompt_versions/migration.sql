-- CreateEnum
CREATE TYPE "MasterPromptEnvironment" AS ENUM ('PRODUCTION', 'PREVIEW');

-- CreateTable
CREATE TABLE "MasterPromptVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "qaStatus" "PromptQAStatus" NOT NULL DEFAULT 'DRAFT',
    "environment" "MasterPromptEnvironment" NOT NULL DEFAULT 'PREVIEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterPromptVersion_environment_version_key" ON "MasterPromptVersion"("environment", "version");
CREATE INDEX "MasterPromptVersion_environment_status_idx" ON "MasterPromptVersion"("environment", "status");
CREATE INDEX "MasterPromptVersion_status_idx" ON "MasterPromptVersion"("status");
CREATE INDEX "MasterPromptVersion_qaStatus_idx" ON "MasterPromptVersion"("qaStatus");
