"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createPromoCode, setPromoCodeActive } from "@/lib/services/promo-code.service";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") throw new Error("Unauthorized.");
}

export async function createPromoCodeAction(formData: FormData) {
  await requireAdmin();
  try {
    const starts = String(formData.get("startsAt") ?? "").trim();
    const expires = String(formData.get("expiresAt") ?? "").trim();
    await createPromoCode({
      code: String(formData.get("code") ?? ""),
      credits: Number(formData.get("credits")),
      maxRedemptions: String(formData.get("maxRedemptions") ?? "").trim() ? Number(formData.get("maxRedemptions")) : null,
      startsAt: starts ? new Date(starts) : null,
      expiresAt: expires ? new Date(expires) : null,
    });
    revalidatePath("/dashboard/admin/promo-codes");
    return { ok: true, message: "Promo code created." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to create promo code." };
  }
}

export async function togglePromoCodeAction(formData: FormData) {
  await requireAdmin();
  try {
    await setPromoCodeActive(String(formData.get("id")), String(formData.get("active")) === "true");
    revalidatePath("/dashboard/admin/promo-codes");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update promo code." };
  }
}
