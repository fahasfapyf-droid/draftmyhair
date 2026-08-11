"use server";

import { auth } from "@/auth";
import { redeemPromoCode } from "@/lib/services/promo-code.service";

export async function redeemPromoCodeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "USER") {
    return { ok: false, message: "Please sign in as a customer to redeem a promo code." };
  }

  try {
    const result = await redeemPromoCode(session.user.id, String(formData.get("code") ?? ""));
    return { ok: true, message: `${result.credits} credit${result.credits === 1 ? "" : "s"} added.`, balance: result.balance };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to redeem promo code." };
  }
}
