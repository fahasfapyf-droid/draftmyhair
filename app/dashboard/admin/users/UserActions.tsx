"use client";

import { useTransition } from "react";
import { banUser, deleteUser, unbanUser } from "./actions";

type Props = { userId: string; isActive: boolean; isDeleted: boolean };

export function UserActions({ userId, isActive, isDeleted }: Props) {
  const [isPending, startTransition] = useTransition();

  const runAction = (action: (formData: FormData) => Promise<void>, message: string) => {
    if (!window.confirm(message)) return;
    const formData = new FormData();
    formData.set("userId", userId);
    startTransition(() => {
      action(formData).catch((error) => {
        window.alert(error instanceof Error ? error.message : "Action failed.");
      });
    });
  };

  if (isDeleted) return <span className="text-xs text-brand-muted">Deleted</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {isActive ? (
        <button type="button" disabled={isPending} onClick={() => runAction(banUser, "Ban this account? The user will be signed out and will not be able to log in until an admin unbans the account. The email address will remain blocked from registering while the ban is active.")} className="rounded-full border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-surface disabled:opacity-50">
          {isPending ? "Working…" : "Ban"}
        </button>
      ) : (
        <button type="button" disabled={isPending} onClick={() => runAction(unbanUser, "Unban this account and allow the user to log in again?")} className="rounded-full border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-surface disabled:opacity-50">
          {isPending ? "Working…" : "Unban"}
        </button>
      )}
      <button type="button" disabled={isPending} onClick={() => runAction(deleteUser, "DELETE this account? The account will be disabled and marked deleted, all sessions will be signed out, and the email address will be released so the person can register a new account again. Historical data remains retained.")} className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50">
        {isPending ? "Working…" : "Delete"}
      </button>
    </div>
  );
}
