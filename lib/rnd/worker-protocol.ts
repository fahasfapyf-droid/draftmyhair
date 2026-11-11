export const RND_WORKER_PROTOCOL_VERSION = "2";

export async function verifyRndWorkerHello(response: Response): Promise<void> {
  if (!response.ok) throw new Error(`Worker hello failed: HTTP ${response.status}`);

  const hello = await response.json() as { ok?: unknown; protocolVersion?: unknown } | null;
  if (hello?.ok !== true || hello.protocolVersion !== RND_WORKER_PROTOCOL_VERSION) {
    throw new Error(`Unsupported worker protocol: expected ${RND_WORKER_PROTOCOL_VERSION}.`);
  }
}
