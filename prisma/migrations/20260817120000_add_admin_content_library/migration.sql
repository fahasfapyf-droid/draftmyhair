DO $$ BEGIN
  CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromptQAStatus" AS ENUM ('DRAFT', 'TESTING', 'PASSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PromptVersion" (
    "id" TEXT NOT NULL,
    "hairstyleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "qaStatus" "PromptQAStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GalleryItem" (
    "id" TEXT NOT NULL,
    "hairstyleId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "beforeUrl" TEXT NOT NULL,
    "afterUrl" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_hairstyleId_version_key" ON "PromptVersion"("hairstyleId", "version");
CREATE INDEX IF NOT EXISTS "PromptVersion_hairstyleId_status_idx" ON "PromptVersion"("hairstyleId", "status");
CREATE INDEX IF NOT EXISTS "PromptVersion_status_idx" ON "PromptVersion"("status");
CREATE INDEX IF NOT EXISTS "PromptVersion_qaStatus_idx" ON "PromptVersion"("qaStatus");
CREATE INDEX IF NOT EXISTS "GalleryItem_hairstyleId_idx" ON "GalleryItem"("hairstyleId");
CREATE INDEX IF NOT EXISTS "GalleryItem_category_idx" ON "GalleryItem"("category");
CREATE INDEX IF NOT EXISTS "GalleryItem_isPublished_idx" ON "GalleryItem"("isPublished");
CREATE INDEX IF NOT EXISTS "GalleryItem_featured_idx" ON "GalleryItem"("featured");
CREATE INDEX IF NOT EXISTS "GalleryItem_displayOrder_idx" ON "GalleryItem"("displayOrder");

DO $$ BEGIN
  ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_hairstyleId_fkey" FOREIGN KEY ("hairstyleId") REFERENCES "Hairstyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_hairstyleId_fkey" FOREIGN KEY ("hairstyleId") REFERENCES "Hairstyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
