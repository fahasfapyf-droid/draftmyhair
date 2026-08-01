import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const ContactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(2).max(150),
  message: z.string().trim().min(10).max(5000),

  // Honeypot field (must stay empty)
  website: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = ContactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid contact form data.",
          issues: result.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      subject,
      message,
      website,
    } = result.data;

    // Reject spam bot submissions
    if (website && website.trim() !== "") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid submission.",
        },
        { status: 400 }
      );
    }

    await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
        ipAddress:
          request.headers.get("x-forwarded-for") ?? null,
        userAgent:
          request.headers.get("user-agent") ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Message received successfully.",
    });
  } catch (error) {
    console.error(
      "Contact form submission failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}