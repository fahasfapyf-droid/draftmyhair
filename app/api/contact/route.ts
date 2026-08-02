import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { checkContactRateLimit } from "@/lib/security/contact-rate-limit";

const ContactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(2).max(150),
  message: z.string().trim().min(10).max(5000),

  // Honeypot field (must stay empty)
  website: z.string().optional(),
});

function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const ipAddress = forwardedFor.split(",")[0]?.trim();

    if (ipAddress) {
      return ipAddress;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    const ipAddress = getClientIpAddress(request);
    const rateLimit = checkContactRateLimit(ipAddress);

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many contact form submissions. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

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
        ipAddress: ipAddress === "unknown" ? null : ipAddress,
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
