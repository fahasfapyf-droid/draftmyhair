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
 *
 * This intentionally uses the public immutable portfolio source so the
 * existing /worker/test-enqueue contract can create the fixture without
 * exposing the private historical Blob URL.
 */

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

const text = await response.text();

if (!response.ok) {
  throw new Error(`R&D fixture creation failed (${response.status}): ${text}`);
}

console.log(text);
