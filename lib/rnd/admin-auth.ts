import type { Prisma } from "@prisma/client";

/**
 * Revalidate and lock an active ADMIN row for the lifetime of a sensitive
 * transaction. FOR SHARE prevents a concurrent role/deactivation update from
 * racing past the authorization check before the protected write commits.
 */
export async function lockActiveAdmin(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userId}
      AND "role" = 'ADMIN'
      AND "isActive" = TRUE
      AND "isDeleted" = FALSE
    FOR SHARE
  `;
  return rows.length === 1;
}
