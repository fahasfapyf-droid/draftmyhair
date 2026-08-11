import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getSalonSession() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SALON") return null;
  return session;
}

export async function GET() {
  const session = await getSalonSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const clients = await prisma.salonClient.findMany({
    where: { salonId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { generations: true } },
    },
  });

  return NextResponse.json({ success: true, clients });
}

export async function POST(request: Request) {
  const session = await getSalonSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { name?: unknown; email?: unknown; phone?: unknown; notes?: unknown; consent?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ success: false, error: "Client name must be between 2 and 120 characters." }, { status: 400 });
  }

  const client = await prisma.salonClient.create({
    data: {
      salonId: session.user.id,
      name,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      consentAt: body.consent === true ? new Date() : null,
    },
  });

  return NextResponse.json({ success: true, client }, { status: 201 });
}
