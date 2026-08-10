-- Correct the production catalog audience classification.
-- All currently seeded HAIRSTYLE engines are female-targeted.
-- Bald and 0.0 mm buzz cut remain explicitly unisex.

UPDATE "Hairstyle"
SET "gender" = 'FEMALE'
WHERE "serviceType" = 'HAIRSTYLE';

UPDATE "Hairstyle"
SET "gender" = 'UNISEX'
WHERE "slug" IN ('bald', 'buzz-cut');
