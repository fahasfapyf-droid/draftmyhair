import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import ResultContent from "./ResultContent";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Your Hairstyle Preview",
  description: "See your personalised hairstyle preview and decide on your next look with confidence.",
  path: "/result",
});

interface ResultPageProps {
  searchParams: Promise<{ generationId?: string | string[] }>;
}

export default async function ResultPage({ searchParams }: ResultPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { generationId } = await searchParams;
  if (typeof generationId !== "string" || !generationId) notFound();

  const generation = await prisma.generation.findFirst({
    where: { id: generationId, userId: session.user.id },
    select: {
      id: true,
      outputImageUrl: true,
      resultStorageKey: true,
      hairstyle: { select: { id: true, name: true } },
    },
  }).catch(() => notFound());

  if (!generation?.outputImageUrl || !generation.resultStorageKey) notFound();

  return (
    <ResultContent
      generation={{
        id: generation.id,
        imageUrl: `/api/blob?pathname=${encodeURIComponent(generation.resultStorageKey)}`,
        hairstyle: generation.hairstyle,
      }}
    />
  );
}
