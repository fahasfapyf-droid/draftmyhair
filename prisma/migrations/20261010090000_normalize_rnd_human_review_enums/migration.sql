-- Convert legacy R&D review states to the current HUMAN_APPROVAL values and
-- rebuild the enum types so Prisma and PostgreSQL expose the same labels.

ALTER TABLE "RnDTarget" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RnDJob" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RnDAttempt" ALTER COLUMN "verdict" DROP DEFAULT;

ALTER TYPE "RnDTargetStatus" RENAME TO "RnDTargetStatus_legacy";
ALTER TYPE "RnDJobStatus" RENAME TO "RnDJobStatus_legacy";
ALTER TYPE "RnDAttemptVerdict" RENAME TO "RnDAttemptVerdict_legacy";

CREATE TYPE "RnDTargetStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'QA', 'HUMAN_APPROVAL', 'APPROVED', 'REJECTED', 'EXHAUSTED', 'FAILED');
CREATE TYPE "RnDJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'QA', 'HUMAN_APPROVAL', 'COMPLETED', 'REFINING', 'EXHAUSTED', 'FAILED', 'CANCELLED');
CREATE TYPE "RnDAttemptVerdict" AS ENUM ('REFINE', 'HUMAN_APPROVAL', 'APPROVED', 'EXHAUSTED', 'FAILED');

ALTER TABLE "RnDTarget"
  ALTER COLUMN "status" TYPE "RnDTargetStatus"
  USING (CASE "status"::text WHEN 'HUMAN_REVIEW' THEN 'HUMAN_APPROVAL' ELSE "status"::text END)::"RnDTargetStatus";

ALTER TABLE "RnDJob"
  ALTER COLUMN "status" TYPE "RnDJobStatus"
  USING (CASE "status"::text WHEN 'HUMAN_REVIEW' THEN 'HUMAN_APPROVAL' ELSE "status"::text END)::"RnDJobStatus";

ALTER TABLE "RnDAttempt"
  ALTER COLUMN "verdict" TYPE "RnDAttemptVerdict"
  USING (CASE "verdict"::text WHEN 'HUMAN_REVIEW' THEN 'HUMAN_APPROVAL' ELSE "verdict"::text END)::"RnDAttemptVerdict";

DROP TYPE "RnDTargetStatus_legacy";
DROP TYPE "RnDJobStatus_legacy";
DROP TYPE "RnDAttemptVerdict_legacy";

ALTER TABLE "RnDTarget" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "RnDJob" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
