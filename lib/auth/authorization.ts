import { Session } from "next-auth";

export function isAdmin(
  session: Session | null | undefined
): boolean {
  return session?.user?.role === "ADMIN";
}

export function requireAdmin(
  session: Session | null | undefined
): void {
  if (!isAdmin(session)) {
    throw new Error("Administrator access required.");
  }
}