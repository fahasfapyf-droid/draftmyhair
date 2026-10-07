import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const baseUrl = process.env.HINDSIGHT_API_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.HINDSIGHT_API_KEY?.trim();
  const bankId = process.env.HINDSIGHT_RND_BANK?.trim() || "draftmyhair-rnd";
  const documentId = `dmh-connectivity-test-${Date.now()}`;

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ ok: false, configured: false, bankId }, { status: 503 });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    const retainResponse = await fetch(
      `${baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/memories`,
      {
        method: "POST",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          async: false,
          items: [{
            content: "Draft My Hair temporary Hindsight connectivity test. This memory must be deleted after verification.",
            document_id: documentId,
            context: "Temporary DMH integration verification",
            metadata: { test: "true", source: "hindsight-health-route" },
            tags: ["dmh-connectivity-test"],
          }],
        }),
      },
    );

    const retainBody = await retainResponse.json().catch(() => null);

    const recallResponse = await fetch(
      `${baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`,
      {
        method: "POST",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          query: "Draft My Hair temporary Hindsight connectivity test",
          max_tokens: 400,
          budget: "low",
          types: ["experience", "observation"],
        }),
      },
    );

    const recallBody = await recallResponse.json().catch(() => null);
    const recalled = Array.isArray(recallBody?.results)
      ? recallBody.results.some((item: { text?: unknown }) =>
          typeof item.text === "string" && item.text.includes("temporary Hindsight connectivity test"),
        )
      : false;

    const deleteResponse = await fetch(
      `${baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    const deleteBody = await deleteResponse.json().catch(() => null);

    return NextResponse.json({
      ok: retainResponse.ok && recallResponse.ok && recalled && deleteResponse.ok,
      configured: true,
      bankId,
      retainStatus: retainResponse.status,
      retainItems: retainBody?.items_count ?? null,
      recallStatus: recallResponse.status,
      recalled,
      deleteStatus: deleteResponse.status,
      deletedDocument: deleteBody?.document_id ?? null,
    }, {
      status: retainResponse.ok && recallResponse.ok && recalled && deleteResponse.ok ? 200 : 502,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      configured: true,
      bankId,
      error: error instanceof Error ? error.message : "Hindsight verification failed",
    }, { status: 502 });
  }
}
