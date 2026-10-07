import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const baseUrl = process.env.HINDSIGHT_API_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.HINDSIGHT_API_KEY?.trim();
  const bankId = process.env.HINDSIGHT_RND_BANK?.trim() || "draftmyhair-rnd";

  if (!baseUrl || !apiKey) {
    return NextResponse.json({
      ok: false,
      configured: false,
      bankId,
    }, { status: 503 });
  }

  try {
    const response = await fetch(
      `${baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/memories/list?limit=1`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    const body = await response.json().catch(() => null);
    return NextResponse.json({
      ok: response.ok,
      configured: true,
      bankId,
      hindsightStatus: response.status,
      memoryCountReturned: Array.isArray(body?.items) ? body.items.length : null,
    }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      configured: true,
      bankId,
      error: error instanceof Error ? error.message : "Hindsight request failed",
    }, { status: 502 });
  }
}
