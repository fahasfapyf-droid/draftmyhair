ALTER TABLE "User" ADD COLUMN "deletedEmail" TEXT;
CREATE UNIQUE INDEX "User_deletedEmail_key" ON "User"("deletedEmail");

-- Existing deleted users had their email retained in the old column.
-- Preserve those values for audit continuity while releasing the login email.
UPDATE "User"
SET "deletedEmail" = "email", "email" = NULL
WHERE "isDeleted" = true AND "email" IS NOT NULL;
