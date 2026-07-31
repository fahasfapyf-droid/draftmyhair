import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cleanupGeneration } from "@/lib/storage/cleanupGeneration";

interface RouteContext {
  params: Promise<{
    generationId: string;
  }>;
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const { generationId } = await params;

  const generation = await prisma.generation.findUnique({
    where: {
      id: generationId,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!generation) {
    return NextResponse.json(
      {
        success: false,
        error: "Generation not found.",
      },
      {
        status: 404,
      }
    );
  }

  if (generation.userId !== session.user.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden.",
      },
      {
        status: 403,
      }
    );
  }

  try {
    await cleanupGeneration(generation.id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Generation deletion failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to delete generation.",
      },
      {
        status: 500,
      }
    );
  }
}