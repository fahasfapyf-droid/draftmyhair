import { NextResponse } from "next/server";

export function requireRndProducer(request: Request) {
  const expected = process.env.RND_PRODUCER_TOKEN?.trim();
  if (!expected) return NextResponse.json({ error: "R&D producer is not configured." }, { status: 503 });
  const header = request.headers.get("authorization")?.trim() ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
