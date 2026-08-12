"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import ContactReply from "@/lib/email/templates/contact-reply";
import { sendEmail } from "@/lib/email/send-email";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return session;
}

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "USER") redirect("/dashboard");

  return session;
}

export async function markContactInProgress(id: string) {
  await requireAdmin();

  await prisma.contactMessage.update({
    where: { id },
    data: { status: "IN_PROGRESS" },
  });

  revalidatePath("/dashboard/admin/contact");
  revalidatePath(`/dashboard/admin/contact/${id}`);
}

export async function markContactResolved(id: string) {
  await requireAdmin();

  await prisma.contactMessage.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/admin/contact");
  revalidatePath(`/dashboard/admin/contact/${id}`);
}

export async function replyToContact(id: string, formData: FormData) {
  const session = await requireAdmin();

  const reply = String(formData.get("reply") ?? "").trim();

  if (!reply) throw new Error("Reply cannot be empty.");
  if (reply.length > 5000) throw new Error("Reply is too long.");

  const message = await prisma.contactMessage.findUnique({
    where: { id },
  });

  if (!message) throw new Error("Contact message not found.");

  const subject = message.subject?.trim() || "Your Draft My Hair enquiry";

  // Persist the conversation first. Email is a notification, not the source of truth.
  await prisma.contactMessageReply.create({
    data: {
      contactMessageId: id,
      senderId: session.user.id,
      senderRole: "ADMIN",
      message: reply,
    },
  });

  let emailFailed = false;

  try {
    await sendEmail({
      to: message.email,
      subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
      react: ContactReply({
        name: message.name,
        originalSubject: subject,
        reply,
      }),
    });
  } catch (error) {
    emailFailed = true;
    console.error("Contact reply email failed:", error);
  }

  await prisma.contactMessage.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      resolvedAt: null,
    },
  });

  revalidatePath("/dashboard/admin/contact");
  revalidatePath(`/dashboard/admin/contact/${id}`);

  redirect(
    `/dashboard/admin/contact/${id}?reply=${emailFailed ? "saved-email-failed" : "sent"}`
  );
}

export async function replyToContactFromUser(id: string, formData: FormData) {
  const session = await requireUser();
  const reply = String(formData.get("reply") ?? "").trim();

  if (!reply) throw new Error("Reply cannot be empty.");
  if (reply.length > 5000) throw new Error("Reply is too long.");

  const contactMessage = await prisma.contactMessage.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!contactMessage) throw new Error("Conversation not found.");

  await prisma.contactMessageReply.create({
    data: {
      contactMessageId: contactMessage.id,
      senderId: session.user.id,
      senderRole: "USER",
      message: reply,
    },
  });

  await prisma.contactMessage.update({
    where: { id: contactMessage.id },
    data: {
      status: "IN_PROGRESS",
      resolvedAt: null,
    },
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${contactMessage.id}`);
  revalidatePath("/dashboard/admin/contact");
  revalidatePath(`/dashboard/admin/contact/${contactMessage.id}`);
}

export async function markContactRepliesRead(id: string) {
  const session = await requireUser();

  await prisma.contactMessageReply.updateMany({
    where: {
      contactMessageId: id,
      senderRole: "ADMIN",
      readAt: null,
      contactMessage: {
        userId: session.user.id,
      },
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${id}`);
}

export async function deleteContact(id: string) {
  await requireAdmin();

  await prisma.contactMessage.delete({
    where: { id },
  });

  revalidatePath("/dashboard/admin/contact");
  redirect("/dashboard/admin/contact");
}
