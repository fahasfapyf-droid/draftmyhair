-- CreateEnum
CREATE TYPE "HairstyleCategory" AS ENUM ('LONG_HAIR', 'MEDIUM_HAIR', 'SHORT_HAIR', 'BOB', 'PIXIE', 'BUZZ', 'BALD', 'BEARD', 'HAIR_COLOR');

-- CreateEnum
CREATE TYPE "HairstyleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "Hairstyle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "HairstyleCategory" NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "HairstyleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hairstyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hairstyle_slug_key" ON "Hairstyle"("slug");

-- CreateIndex
CREATE INDEX "Hairstyle_category_idx" ON "Hairstyle"("category");

-- CreateIndex
CREATE INDEX "Hairstyle_status_idx" ON "Hairstyle"("status");
