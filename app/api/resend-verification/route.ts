import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createEmailVerification } from "@/lib/auth/email-verification";

const schema = z.object({
  email: z.string().email(),
});

const RESEND_COOLDOWN_MINUTES = 5;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message:
            "If an account exists, a verification email has been sent.",
        },
        { status: 200 }
      );
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    // Never reveal whether the email exists
    if (!user) {
      return NextResponse.json({
        message:
          "If an account exists, a verification email has been sent.",
      });
    }

    // Already verified
    if (user.emailVerified) {
      return NextResponse.json({
        message: "Your email is already verified.",
      });
    }

    const existingToken =
      await prisma.verificationToken.findFirst({
        where: {
          identifier: email,
        },
        orderBy: {
          expires: "desc",
        },
      });

    if (existingToken) {
      const createdAt =
        new Date(existingToken.expires).getTime() -
        24 * 60 * 60 * 1000;

      const minutesSinceCreated =
        (Date.now() - createdAt) /
        (1000 * 60);

      if (
        minutesSinceCreated <
        RESEND_COOLDOWN_MINUTES
      ) {
        return NextResponse.json({
          message:
            "Please wait a few minutes before requesting another verification email.",
        });
      }
    }

    // These checks narrow the Prisma types from
// string | null to string.

if (!user.email) {
  return NextResponse.json(
    {
      message:
        "Unable to resend verification email.",
    },
    {
      status: 500,
    }
  );
}

await createEmailVerification(
  user.id,
  user.email,
  user.name
);

    return NextResponse.json({
      message:
        "Verification email sent successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message:
          "Unable to resend verification email.",
      },
      {
        status: 500,
      }
    );
  }
}