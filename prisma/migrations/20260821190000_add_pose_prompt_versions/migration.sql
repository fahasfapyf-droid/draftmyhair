CREATE TABLE IF NOT EXISTS "PosePromptVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "qaStatus" "PromptQAStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PosePromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PosePromptVersion_slug_version_key" ON "PosePromptVersion"("slug", "version");
CREATE INDEX IF NOT EXISTS "PosePromptVersion_slug_status_idx" ON "PosePromptVersion"("slug", "status");
CREATE INDEX IF NOT EXISTS "PosePromptVersion_status_idx" ON "PosePromptVersion"("status");
CREATE INDEX IF NOT EXISTS "PosePromptVersion_qaStatus_idx" ON "PosePromptVersion"("qaStatus");
