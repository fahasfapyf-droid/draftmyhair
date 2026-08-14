import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import ResultContent from "@/app/result/ResultContent";

interface GenerationDetailPageProps {
  params: Promise<{
    generationId: string;
  }>;
}

export default async function GenerationDetailPage({
  params,
}: GenerationDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { generationId } = await params;

  const generation = await prisma.generation.findFirst({
    where: {
      id: generationId,
      userId: session.user.id,
    },
    select: {
      id: true,
      outputImageUrl: true,
      resultStorageKey: true,
      hairstyle: {
        select: {
          id: true,
          name: true,
        },
      },
      feedback: {
        select: {
          overallRating: true,
          identityRating: true,
          realismRating: true,
          decisionConfidence: true,
          issues: true,
          comment: true,
        },
      },
    },
  });

  if (!generation?.outputImageUrl || !generation.resultStorageKey) {
    notFound();
  }

  return (
    <ResultContent
      generation={{
        id: generation.id,
        imageUrl: `/api/blob?pathname=${encodeURIComponent(
          generation.resultStorageKey
        )}`,
        hairstyle: generation.hairstyle,
        existingFeedback: generation.feedback,
      }}
    />
  );
}
