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
          id: true,
          overallRating: true,
          identityRating: true,
          realismRating: true,
          decisionConfidence: true,
          issues: true,
          comment: true,
          createdAt: true,
        },
      },
    },
  });

  if (!generation?.outputImageUrl || !generation.resultStorageKey) {
    notFound();
  }

  const pathname = encodeURIComponent(generation.resultStorageKey);
  const style = encodeURIComponent(generation.hairstyle.name);

  return (
    <ResultContent
      generation={{
        id: generation.id,
        imageUrl: `/api/blob?pathname=${pathname}`,
        downloadUrl: `/api/download?pathname=${pathname}&style=${style}`,
        hairstyle: generation.hairstyle,
        feedback: generation.feedback,
      }}
    />
  );
}
