"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import ContactReply from "@/lib/email/templates/contact-reply";
import { sendEmail } from "@/lib/email/send-email";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }
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
  await requireAdmin();

  const reply = String(formData.get("reply") ?? "").trim();

  if (!reply) {
    throw new Error("Reply cannot be empty.");
  }

  if (reply.length > 5000) {
    throw new Error("Reply is too long.");
  }

  const message = await prisma.contactMessage.findUnique({
    where: { id },
  });

  if (!message) {
    throw new Error("Contact message not found.");
  }

  const subject = message.subject?.trim() || "Your Draft My Hair enquiry";

  await sendEmail({
    to: message.email,
    subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
    react: ContactReply({
      name: message.name,
      originalSubject: subject,
      reply,
    }),
  });

  await prisma.contactMessage.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      resolvedAt: null,
    },
  });

  revalidatePath("/dashboard/admin/contact");
  revalidatePath(`/dashboard/admin/contact/${id}`);

  redirect(`/dashboard/admin/contact/${id}?reply=sent`);
}

export async function deleteContact(id: string) {
  await requireAdmin();

  await prisma.contactMessage.delete({
    where: { id },
  });

  revalidatePath("/dashboard/admin/contact");
  redirect("/dashboard/admin/contact");
}
