CREATE TABLE "SalonClient" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "consentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalonClient_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Generation" ADD COLUMN "salonClientId" TEXT;

CREATE INDEX "SalonClient_salonId_idx" ON "SalonClient"("salonId");
CREATE INDEX "SalonClient_name_idx" ON "SalonClient"("name");
CREATE INDEX "SalonClient_createdAt_idx" ON "SalonClient"("createdAt");
CREATE INDEX "Generation_salonClientId_idx" ON "Generation"("salonClientId");

ALTER TABLE "SalonClient" ADD CONSTRAINT "SalonClient_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Generation" ADD CONSTRAINT "Generation_salonClientId_fkey"
  FOREIGN KEY ("salonClientId") REFERENCES "SalonClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
