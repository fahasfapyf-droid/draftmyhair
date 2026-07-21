-- CreateEnum
CREATE TYPE "GenderTarget" AS ENUM ('FEMALE', 'MALE', 'UNISEX');

-- AlterTable
ALTER TABLE "Hairstyle" ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "gender" "GenderTarget" NOT NULL DEFAULT 'UNISEX',
ADD COLUMN     "heroImage" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promptKey" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "thumbnailImage" TEXT;

-- CreateIndex
CREATE INDEX "Hairstyle_gender_idx" ON "Hairstyle"("gender");

-- CreateIndex
CREATE INDEX "Hairstyle_isFeatured_idx" ON "Hairstyle"("isFeatured");
