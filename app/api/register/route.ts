import { NextResponse } from "next/server";
import { z } from "zod";

import { registerUser } from "@/lib/auth/register";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const { verificationEmailSent } = await registerUser(
      name,
      email,
      password
    );

    return NextResponse.json(
      {
        message: verificationEmailSent
          ? "User registered successfully."
          : "Account created successfully, but the verification email could not be sent. Please use the resend verification option.",
        verificationEmailSent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    const message =
      error instanceof Error ? error.message : "Registration failed.";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
