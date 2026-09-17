const bypassSecret = process.env.VERCEL_PROTECTION_BYPASS_SECRET?.trim();

if (bypassSecret) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("x-vercel-protection-bypass", bypassSecret);
    return originalFetch(input, { ...init, headers });
  };
}
