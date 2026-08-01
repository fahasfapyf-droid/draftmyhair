"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
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
    where: {
      id,
    },
    data: {
      status: "IN_PROGRESS",
    },
  });

  revalidatePath("/dashboard/admin/contact");
  revalidatePath(`/dashboard/admin/contact/${id}`);
}

export async function markContactResolved(id: string) {
  await requireAdmin();

  await prisma.contactMessage.update({
    where: {
      id,
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/admin/contact");
  revalidatePath(`/dashboard/admin/contact/${id}`);
}

export async function deleteContact(id: string) {
  await requireAdmin();

  await prisma.contactMessage.delete({
    where: {
      id,
    },
  });

  revalidatePath("/dashboard/admin/contact");

  redirect("/dashboard/admin/contact");
}