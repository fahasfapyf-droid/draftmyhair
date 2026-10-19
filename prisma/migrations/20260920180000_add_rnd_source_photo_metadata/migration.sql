-- Add simple curator-provided metadata to reusable R&D source photos.
ALTER TABLE "RnDAsset"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "genderPresentation" TEXT,
  ADD COLUMN "cohortLabel" TEXT,
  ADD COLUMN "hairTexture" TEXT,
  ADD COLUMN "hairLength" TEXT,
  ADD COLUMN "notes" TEXT;

CREATE INDEX "RnDAsset_genderPresentation_idx" ON "RnDAsset"("genderPresentation");
CREATE INDEX "RnDAsset_cohortLabel_idx" ON "RnDAsset"("cohortLabel");
CREATE INDEX "RnDAsset_hairTexture_idx" ON "RnDAsset"("hairTexture");
CREATE INDEX "RnDAsset_hairLength_idx" ON "RnDAsset"("hairLength");
