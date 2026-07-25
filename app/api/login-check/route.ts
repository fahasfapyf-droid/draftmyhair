import { NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";

import { prisma } from "@/lib/prisma";

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
        {
          status: "INVALID_CREDENTIALS",
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({
        status: "INVALID_CREDENTIALS",
      });
    }

    const validPassword = await argon2.verify(
      user.passwordHash,
      password
    );

    if (!validPassword) {
      return NextResponse.json({
        status: "INVALID_CREDENTIALS",
      });
    }

    if (!user.emailVerified) {
      return NextResponse.json({
        status: "EMAIL_NOT_VERIFIED",
      });
    }

    return NextResponse.json({
      status: "SUCCESS",
    });
  } catch {
    return NextResponse.json(
      {
        status: "ERROR",
      },
      {
        status: 500,
      }
    );
  }
}