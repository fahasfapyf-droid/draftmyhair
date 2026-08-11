"use client";

import { useState } from "react";
import { redeemPromoCodeAction } from "@/app/dashboard/actions";

export function PromoCodeCard() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    const formData = new FormData();
    formData.set("code", code);
    const result = await redeemPromoCodeAction(formData);
    setSuccess(result.ok);
    setMessage(result.message);
    if (result.ok) setCode("");
    setBusy(false);
  }

  return (
    <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-ink">Redeem Promo Code</h2>
      <p className="mt-2 text-sm text-brand-muted">Have a promotional code? Enter it to add credits to your account.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          maxLength={64}
          placeholder="Enter promo code"
          className="min-w-0 flex-1 rounded-lg border border-brand-border bg-white px-4 py-2 text-sm text-brand-ink outline-none focus:ring-2 focus:ring-brand-primary"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !code.trim()}
          className="rounded-lg bg-brand-ink px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Redeeming…" : "Redeem"}
        </button>
      </div>
      {message && <p className={`mt-3 text-sm ${success ? "text-green-700" : "text-red-600"}`}>{message}</p>}
    </div>
  );
}
