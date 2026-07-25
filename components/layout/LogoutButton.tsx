"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  mobile?: boolean;
  onLogout?: () => void;
}

export function LogoutButton({
  mobile = false,
  onLogout,
}: LogoutButtonProps) {
  async function handleLogout() {
    if (onLogout) {
      onLogout();
    }

    await signOut({
      callbackUrl: "/login",
    });
  }

  if (mobile) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="text-brand-ink"
      >
        Logout
      </button>
    );
  }

  return (
    <Button
      variant="primary"
      onClick={handleLogout}
    >
      Logout
    </Button>
  );
}