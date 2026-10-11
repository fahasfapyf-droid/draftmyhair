/**
 * Controlled R&D regression fixture launcher.
 *
 * Uses only the R&D worker API. No production database access.
 *
 * Required env:
 *   RND_PREVIEW_BASE_URL
 *   RND_WORKER_TOKEN
 *
 * Optional:
 *   RND_WORKER_ID
 */

async function main() {
  const baseUrl = process.env.RND_PREVIEW_BASE_URL?.replace(/\/$/, "");
  const token = process.env.RND_WORKER_TOKEN;
  const workerId = process.env.RND_WORKER_ID || "school-pc-regression";

  if (!baseUrl) throw new Error("RND_PREVIEW_BASE_URL is required.");
  if (!token) throw new Error("RND_WORKER_TOKEN is required.");

  const response = await fetch(`${baseUrl}/api/rnd/worker/test-enqueue`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-rnd-worker-id": workerId,
    },
    body: JSON.stringify({
      sourceUrl: "https://www.draftmyhair.com/portfolio/bob/french-bob-before.webp",
      promptKey: "italian-bob",
      targetKey: `regression-italian-bob-universal-refinement-${Date.now()}`,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`R&D fixture creation failed (${response.status}): ${responseText}`);
  }

  console.log(responseText);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
