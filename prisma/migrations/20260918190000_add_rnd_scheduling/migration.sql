-- Durable R&D job scheduling state.
ALTER TABLE "RnDJob" ADD COLUMN "nextEligibleAt" TIMESTAMP(3);
