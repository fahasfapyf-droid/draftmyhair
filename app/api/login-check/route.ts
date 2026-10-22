import { NextResponse } from "next/server";
import { z } from "zod";

import { loginUser } from "@/lib/auth/login";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { status: "INVALID_CREDENTIALS" },
        { status: 400 }
      );
    }

    const result = await loginUser(
      parsed.data.email,
      parsed.data.password
    );

    if (result.status === "RATE_LIMITED") {
      return NextResponse.json(
        {
          status: "RATE_LIMITED",
          message:
            "Too many unsuccessful sign-in attempts. Please try again in 15 minutes.",
        },
        { status: 429 }
      );
    }

    if (result.status === "ACCOUNT_DISABLED") {
      return NextResponse.json(
        {
          status: "ACCOUNT_DISABLED",
          message:
            "You are banned from using this service. Please contact the administrator.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ status: result.status });
  } catch (error: unknown) {
    // Log only non-sensitive diagnostic fields. Never log request bodies,
    // credentials, user identifiers, or raw exception messages.
    const errorName =
      error instanceof Error ? error.name : "UnknownError";
    const errorCode =
      typeof error === "object" && error !== null && "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;

    console.error("[login-check] Login request failed", {
      errorName,
      ...(errorCode ? { errorCode } : {}),
    });

    return NextResponse.json(
      { status: "ERROR" },
      { status: 500 }
    );
  }
}
