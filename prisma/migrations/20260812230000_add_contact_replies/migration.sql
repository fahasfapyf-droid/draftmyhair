-- Add user ownership to contact messages without breaking anonymous submissions.
ALTER TABLE "ContactMessage" ADD COLUMN "userId" TEXT;

-- Persist replies as a real conversation history.
CREATE TYPE "ContactReplySender" AS ENUM ('USER', 'ADMIN');

CREATE TABLE "ContactMessageReply" (
    "id" TEXT NOT NULL,
    "contactMessageId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" "ContactReplySender" NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessageReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_userId_idx" ON "ContactMessage"("userId");
CREATE INDEX "ContactMessageReply_contactMessageId_idx" ON "ContactMessageReply"("contactMessageId");
CREATE INDEX "ContactMessageReply_senderId_idx" ON "ContactMessageReply"("senderId");
CREATE INDEX "ContactMessageReply_createdAt_idx" ON "ContactMessageReply"("createdAt");
CREATE INDEX "ContactMessageReply_senderRole_readAt_idx" ON "ContactMessageReply"("senderRole", "readAt");

ALTER TABLE "ContactMessage"
ADD CONSTRAINT "ContactMessage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactMessageReply"
ADD CONSTRAINT "ContactMessageReply_contactMessageId_fkey"
FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactMessageReply"
ADD CONSTRAINT "ContactMessageReply_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
