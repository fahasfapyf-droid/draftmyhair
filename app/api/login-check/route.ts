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

    return NextResponse.json({ status: result.status });
  } catch {
    return NextResponse.json(
      { status: "ERROR" },
      { status: 500 }
    );
  }
}
