import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    apiKeyExists: !!process.env.GEMINI_API_KEY,
    keyLength: process.env.GEMINI_API_KEY?.length ?? 0,
  });
}