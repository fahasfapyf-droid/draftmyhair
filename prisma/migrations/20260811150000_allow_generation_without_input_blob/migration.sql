-- Input images are now kept in memory for the synchronous generation request.
-- Existing rows retain their stored inputImageUrl values; new generations may leave it NULL.
ALTER TABLE "Generation"
ALTER COLUMN "inputImageUrl" DROP NOT NULL;
