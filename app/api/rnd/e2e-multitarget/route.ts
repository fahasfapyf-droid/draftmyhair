import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { generateAutonomousPrompt } from "@/lib/rnd/autonomous-prompt";

export const runtime = "nodejs";

const SOURCE_URL = "https://www.draftmyhair.com/portfolio/bob/french-bob-before.webp";
const STYLE_KEYS = ["italian-bob", "blunt-lob", "soft-layered-bob"];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") return json({ error: "Preview-only R&D smoke route." }, 404);


