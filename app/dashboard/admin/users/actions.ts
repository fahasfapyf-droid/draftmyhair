"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return session.user.id;
}

async function getTargetUser(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isDeleted: true },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.id === adminId) {
    throw new Error("You cannot modify your own admin account.");
  }

  if (user.role === "ADMIN") {
    throw new Error("Admin accounts cannot be modified from this screen.");
  }

  return user;
}

export async function banUser(formData: FormData) {
  const adminId = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    throw new Error("User ID is required.");
  }

  await getTargetUser(userId, adminId);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        sessionVersion: { increment: 1 },
      },
    });

    await tx.session.deleteMany({ where: { userId } });
  });

  revalidatePath("/dashboard/admin/users");
}

export async function deleteUser(formData: FormData) {
  const adminId = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const user = await getTargetUser(userId, adminId);

  if (user.isDeleted) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        isDeleted: true,
        deletedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    });

    await tx.session.deleteMany({ where: { userId } });
  });

  revalidatePath("/dashboard/admin/users");
}

export async function unbanUser(formData: FormData) {
  const adminId = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const user = await getTargetUser(userId, adminId);

  if (user.isDeleted) {
    throw new Error("Deleted accounts cannot be unbanned from this screen.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: true,
      sessionVersion: { increment: 1 },
    },
  });

  revalidatePath("/dashboard/admin/users");
}
