-- CreateTable
CREATE TABLE "RnDWorkerStatus" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workerVersion" TEXT,
    "protocolVersion" TEXT,
    "workerState" TEXT NOT NULL DEFAULT 'ONLINE',
    "activeProfileId" TEXT,
    "activeProfileLabel" TEXT,
    "currentJobId" TEXT,
    "captureStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "captureLastSuccessAt" TIMESTAMP(3),
    "captureLastError" TEXT,
    "profileSnapshot" JSONB,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RnDWorkerStatus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RnDWorkerStatus_workerId_key" ON "RnDWorkerStatus"("workerId");
CREATE INDEX "RnDWorkerStatus_workerState_idx" ON "RnDWorkerStatus"("workerState");
CREATE INDEX "RnDWorkerStatus_lastHeartbeatAt_idx" ON "RnDWorkerStatus"("lastHeartbeatAt");
CREATE INDEX "RnDWorkerStatus_activeProfileId_idx" ON "RnDWorkerStatus"("activeProfileId");
