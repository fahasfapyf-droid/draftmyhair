import type { Prisma } from "@prisma/client";

const TERMINAL_TARGET_STATUSES = new Set(["APPROVED", "REJECTED", "EXHAUSTED"]);

export async function reconcileRndCampaignLifecycle(
  tx: Prisma.TransactionClient,
  campaignId: string,
) {
  const campaign = await tx.rnDCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      status: true,
      autoAdvanceEnabled: true,
      targets: { select: { status: true } },
    },
  });

  if (!campaign || campaign.status === "CANCELLED") return null;
  if (!campaign.targets.length) return campaign.status;

  const allTerminal = campaign.targets.every((target) =>
    TERMINAL_TARGET_STATUSES.has(target.status),
  );

  if (!allTerminal) return campaign.status;

  const updated = await tx.rnDCampaign.update({
    where: { id: campaign.id },
    data: { status: "COMPLETED" },
    select: { status: true },
  });

  return updated.status;
}
