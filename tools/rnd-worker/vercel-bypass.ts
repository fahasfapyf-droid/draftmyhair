const bypassSecret = (
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ??
  process.env.VERCEL_PROTECTION_BYPASS_SECRET
)?.trim();

if (bypassSecret) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("x-vercel-protection-bypass", bypassSecret);
    headers.set("x-vercel-set-bypass-cookie", "true");

    // Vercel documents both header and query-string bypasses. Keep the
    // header as the primary mechanism; the query fallback also works when
    // the deployment's protection layer does not honor custom headers.
    const requestUrl = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const url = new URL(requestUrl);
    url.searchParams.set("x-vercel-protection-bypass", bypassSecret);
    url.searchParams.set("x-vercel-set-bypass-cookie", "true");

    return originalFetch(url, { ...init, headers });
  };
}
