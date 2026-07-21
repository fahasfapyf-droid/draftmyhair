import { NextResponse } from "next/server";
import {
  createFeedback,
  validateFeedbackInput,
} from "@/lib/services/feedback.service";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Request body must be valid JSON.",
      },
      {
        status: 400,
      }
    );
  }

  const validation = validateFeedbackInput(body);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Invalid feedback submission.",
        details: validation.errors,
      },
      {
        status: 400,
      }
    );
  }

  try {
    const result = await createFeedback(validation.data);

    if (!result.created) {
      return NextResponse.json(
        {
          error: "Hairstyle not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      id: result.feedback.id,
      createdAt: result.feedback.createdAt,
    }, {
      status: 201,
    });
  } catch (error) {
    console.error("Failed to create feedback:", error);

    return NextResponse.json(
      {
        error: "Failed to create feedback",
      },
      {
        status: 500,
      }
    );
  }
}
