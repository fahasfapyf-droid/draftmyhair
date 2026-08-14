"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function rating(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) throw new Error("QA ratings must be between 1 and 5.");
  return parsed;
}

export async function saveGenerationQa(generationId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  const generation = await prisma.generation.findUnique({ where: { id: generationId }, select: { id: true, metadata: true } });
  if (!generation) throw new Error("Generation not found.");

  const overall = rating(formData.get("overall"));
  const identity = rating(formData.get("identity"));
  const integration = rating(formData.get("integration"));
  const realism = rating(formData.get("realism"));
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000);

  const currentMetadata = generation.metadata && typeof generation.metadata === "object" && !Array.isArray(generation.metadata)
    ? generation.metadata as Record<string, unknown>
    : {};

  await prisma.generation.update({
    where: { id: generation.id },
    data: {
      metadata: {
        ...currentMetadata,
        qa: {
          overall,
          identity,
          integration,
          realism,
          notes: notes || null,
          reviewedBy: session.user.id,
          reviewedAt: new Date().toISOString(),
        },
      },
    },
  });

  revalidatePath("/dashboard/admin/generations");
}
