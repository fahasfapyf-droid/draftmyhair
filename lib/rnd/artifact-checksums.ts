import type { Prisma } from "@prisma/client";

export async function readPriorRndArtifactChecksums(
  db: Pick<Prisma.TransactionClient, "rnDAttempt">, jobId: string, attemptNumber: number,
): Promise<string[] | null> {
  const previous = await db.rnDAttempt.findMany({
    where: { jobId, attemptNumber: { lt: attemptNumber }, artifact: { is: { kind: "GENERATED" } } },
    select: { artifact: { select: { checksum: true } } },
  });
  const checksums = new Set<string>();
  for (const { artifact } of previous) {
    if (!artifact?.checksum || !/^[a-f0-9]{64}$/i.test(artifact.checksum)) return null;
    checksums.add(artifact.checksum.toLowerCase());
  }
  return [...checksums];
}
