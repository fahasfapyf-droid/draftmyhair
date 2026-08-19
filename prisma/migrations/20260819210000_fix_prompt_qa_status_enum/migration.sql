-- The Prisma schema includes PASSED in PromptQAStatus, but older databases
-- may already have the enum without that value. Add it idempotently.
ALTER TYPE "PromptQAStatus" ADD VALUE IF NOT EXISTS 'PASSED';
