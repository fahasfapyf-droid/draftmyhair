/** Bound streamed bodies too: Content-Length is neither required nor trusted. */
export async function readBoundedJson(response: Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("RND_EMPTY_RESPONSE");
  let size = 0;
  const chunks: Uint8Array[] = [];
  let rejectAbort!: (error: Error) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(new Error("RND_RESPONSE_TIMEOUT"));
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal.aborted) throw new Error("RND_RESPONSE_TIMEOUT");
    for (;;) {
      const result = await Promise.race([reader.read(), aborted]);
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maxBytes) throw new Error("RND_RESPONSE_TOO_LARGE");
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally {
    signal.removeEventListener("abort", onAbort);
    void reader.cancel().catch(() => undefined);
  }
}

/** Reject executable/privileged content; never return credentials in diagnostics. */
export function unsafeResearchText(text: string): boolean {
  return /(?:postgres(?:ql)?:\/\/|vercel_blob_rw_|-----BEGIN [A-Z ]*PRIVATE KEY|\bAIza[\w-]+|\bsk-[\w-]{16,}|https?:\/\/[^\s/]+@|\bBearer\s+\S+|\b(?:api[_ -]?key|password|secret|token)\s*[:=]|\bcurl\s+(?:https?:\/\/|--?\S+|(?:[\w-]+\.)+[\w-]+(?:[/:\s]|$)|localhost(?:[:/\s]|$))|\b(?:wget|powershell|cmd\.exe|bash|subprocess|eval|exec)\b|\b(?:rm\s+-|sudo\b|chmod\b|ssh\b|python(?:3)?\s+-|node\s+-|Invoke-\w+\b)|\$\(|\b(?:DROP|ALTER|DELETE|INSERT|UPDATE)\s+(?:TABLE|FROM|INTO|"?RnD)|\b(?:ignore|override|bypass|disable)\b.{0,60}\b(?:instruction|master|identity|gate|approval|qa|policy)|\b(?:queue|claim|upload|delete)\b.{0,30}\b(?:job|blob|artifact|worker)|\/api\/rnd\/|```|<\/?(?:script|system)\b)/i.test(text);
}
