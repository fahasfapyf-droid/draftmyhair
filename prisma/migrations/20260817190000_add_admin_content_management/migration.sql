-- Admin content management: versioned style prompts and database-backed gallery items.

CREATE TYPE "PromptQAStatus" AS ENUM ('DRAFT', 'TESTING', 'QA_PASSED', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "StylePrompt" (
  "id" TEXT NOT NULL,
  "hairstyleId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "notes" TEXT,
  "qaStatus" "PromptQAStatus" NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StylePrompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryItem" (
  "id" TEXT NOT NULL,
  "hairstyleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "beforeUrl" TEXT NOT NULL,
  "afterUrl" TEXT NOT NULL,
  "caption" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StylePrompt_hairstyleId_version_key" ON "StylePrompt"("hairstyleId", "version");
CREATE INDEX "StylePrompt_hairstyleId_isActive_idx" ON "StylePrompt"("hairstyleId", "isActive");
CREATE INDEX "StylePrompt_qaStatus_idx" ON "StylePrompt"("qaStatus");
CREATE INDEX "GalleryItem_hairstyleId_idx" ON "GalleryItem"("hairstyleId");
CREATE INDEX "GalleryItem_isPublished_displayOrder_idx" ON "GalleryItem"("isPublished", "displayOrder");
CREATE INDEX "GalleryItem_featured_idx" ON "GalleryItem"("featured");

ALTER TABLE "StylePrompt" ADD CONSTRAINT "StylePrompt_hairstyleId_fkey"
  FOREIGN KEY ("hairstyleId") REFERENCES "Hairstyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_hairstyleId_fkey"
  FOREIGN KEY ("hairstyleId") REFERENCES "Hairstyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "GalleryItem" ("id","hairstyleId","title","category","beforeUrl","afterUrl","displayOrder","featured","isPublished","createdAt","updatedAt")
SELECT 'gallery-french-bob', id, 'French Bob', 'bob', '/portfolio/bob/french-bob-before.webp', '/portfolio/bob/french-bob-after.webp', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Hairstyle" WHERE "slug"='french-bob' ON CONFLICT ("id") DO NOTHING;
INSERT INTO "GalleryItem" ("id","hairstyleId","title","category","beforeUrl","afterUrl","displayOrder","featured","isPublished","createdAt","updatedAt")
SELECT 'gallery-old-money-bob', id, 'Old Money Bob', 'bob', '/portfolio/bob/old-money-bob-before.webp', '/portfolio/bob/old-money-bob-after.webp', 2, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Hairstyle" WHERE "slug"='old-money-bob' ON CONFLICT ("id") DO NOTHING;
INSERT INTO "GalleryItem" ("id","hairstyleId","title","category","beforeUrl","afterUrl","displayOrder","featured","isPublished","createdAt","updatedAt")
SELECT 'gallery-soft-layered-bob', id, 'Soft Layered Bob', 'bob', '/portfolio/bob/soft-layered-bob-before.webp', '/portfolio/bob/soft-layered-bob-after.webp', 3, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Hairstyle" WHERE "slug"='soft-layered-bob' ON CONFLICT ("id") DO NOTHING;
INSERT INTO "GalleryItem" ("id","hairstyleId","title","category","beforeUrl","afterUrl","displayOrder","featured","isPublished","createdAt","updatedAt")
SELECT 'gallery-blunt-bob', id, 'Blunt Bob', 'bob', '/portfolio/bob/blunt-bob-before.webp', '/portfolio/bob/blunt-bob-after.webp', 4, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Hairstyle" WHERE "slug"='blunt-bob' ON CONFLICT ("id") DO NOTHING;
