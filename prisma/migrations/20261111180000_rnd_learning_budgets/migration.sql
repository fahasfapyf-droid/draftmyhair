ALTER TABLE "RnDJob" ADD COLUMN "maxGenerationAttempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "RnDJob" ADD COLUMN "infrastructureRetryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RnDJob" ADD COLUMN "planningDiagnostics" JSONB;
ALTER TABLE "RnDJob" ADD CONSTRAINT "RnDJob_generation_budget_check" CHECK ("maxGenerationAttempts" BETWEEN 1 AND 5);
ALTER TABLE "RnDJob" ADD CONSTRAINT "RnDJob_retry_nonnegative_check" CHECK ("infrastructureRetryCount" >= 0 AND "refinementCount" >= 0);
