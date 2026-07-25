"use server";

import argon2 from "argon2";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function updateProfile(
  formData: FormData
) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const name = formData
    .get("name")
    ?.toString()
    .trim();

  if (!name) {
    throw new Error("Name is required.");
  }

  if (name.length < 2) {
    throw new Error(
      "Name must contain at least 2 characters."
    );
  }

  if (name.length > 100) {
    throw new Error(
      "Name cannot exceed 100 characters."
    );
  }

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      name,
    },
  });

  revalidatePath("/dashboard/profile");

  redirect("/dashboard/profile");
}

export async function changePassword(
  formData: FormData
) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentPassword = formData
    .get("currentPassword")
    ?.toString();

  const newPassword = formData
    .get("newPassword")
    ?.toString();

  const confirmPassword = formData
    .get("confirmPassword")
    ?.toString();

  if (
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {
    redirect(
      "/dashboard/profile/password?error=missing-fields"
    );
  }

  if (newPassword.length < 8) {
    redirect(
      "/dashboard/profile/password?error=password-too-short"
    );
  }

  if (newPassword !== confirmPassword) {
    redirect(
      "/dashboard/profile/password?error=passwords-do-not-match"
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
  });

  if (!user?.passwordHash) {
    redirect(
      "/dashboard/profile/password?error=user-not-found"
    );
  }

  const validPassword = await argon2.verify(
    user.passwordHash,
    currentPassword
  );

  if (!validPassword) {
    redirect(
      "/dashboard/profile/password?error=incorrect-password"
    );
  }

  const samePassword = await argon2.verify(
    user.passwordHash,
    newPassword
  );

  if (samePassword) {
    redirect(
      "/dashboard/profile/password?error=same-password"
    );
  }

  const passwordHash = await argon2.hash(
    newPassword
  );

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      passwordHash,
    },
  });

  revalidatePath("/dashboard/profile");

  redirect(
    "/dashboard/profile?success=password-updated"
  );
}