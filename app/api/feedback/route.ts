import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import {
  createFeedback,
  validateFeedbackInput,
} from "@/lib/services/feedback.service";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation = validateFeedbackInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid feedback submission.", details: validation.errors },
      { status: 400 }
    );
  }

  try {
    const result = await createFeedback(validation.data, session.user.id);

    if (!result.created) {
      return NextResponse.json(
        { error: "Generation not found or not owned by this account." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { id: result.feedback.id, createdAt: result.feedback.createdAt },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Feedback has already been submitted for this generation." },
        { status: 409 }
      );
    }

    console.error("Failed to create feedback:", error);
    return NextResponse.json({ error: "Failed to create feedback" }, { status: 500 });
  }
}
