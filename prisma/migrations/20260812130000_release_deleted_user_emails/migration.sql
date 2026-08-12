ALTER TABLE "User" ADD COLUMN "deletedEmail" TEXT;

CREATE INDEX "User_deletedEmail_idx" ON "User"("deletedEmail");

UPDATE "User"
SET
  "deletedEmail" = "email",
  "email" = NULL
WHERE "isDeleted" = true
  AND "email" IS NOT NULL;
