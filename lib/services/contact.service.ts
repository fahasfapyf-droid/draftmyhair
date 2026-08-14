import { ContactStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const CONTACT_MESSAGES_PAGE_SIZE = 20;

type ContactMessagesOptions = {
  page: number;
  search?: string;
  status?: ContactStatus;
};

export async function getContactMessages({
  page,
  search,
  status,
}: ContactMessagesOptions) {
  const where: Prisma.ContactMessageWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { subject: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const messages = await prisma.contactMessage.findMany({
    where,
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          senderRole: true,
          message: true,
          readAt: true,
          createdAt: true,
        },
      },
    },
    skip: (page - 1) * CONTACT_MESSAGES_PAGE_SIZE,
    take: CONTACT_MESSAGES_PAGE_SIZE + 1,
  });

  return {
    messages: messages.slice(0, CONTACT_MESSAGES_PAGE_SIZE),
    hasNextPage: messages.length > CONTACT_MESSAGES_PAGE_SIZE,
  };
}

export async function getUserContactInbox(userId: string) {
  return prisma.contactMessage.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          senderRole: true,
          message: true,
          readAt: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getUserContactConversation(
  userId: string,
  contactMessageId: string
) {
  return prisma.contactMessage.findFirst({
    where: {
      id: contactMessageId,
      userId,
    },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          senderId: true,
          senderRole: true,
          message: true,
          readAt: true,
          createdAt: true,
        },
      },
    },
  });
}
