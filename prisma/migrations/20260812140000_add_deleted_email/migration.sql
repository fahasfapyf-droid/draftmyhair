ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedEmail" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_deletedEmail_key" ON "User"("deletedEmail");

UPDATE "User"
SET "deletedEmail" = "email", "email" = NULL
WHERE "isDeleted" = true AND "email" IS NOT NULL AND "deletedEmail" IS NULL;
