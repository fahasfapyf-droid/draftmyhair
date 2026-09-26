const apiBase = (process.env.RND_API_BASE ?? "https://draftmyhair-git-rnd-prompt-lab-v3-draftmyhair.vercel.app").replace(/\/$/, "");
const token = process.env.RND_WORKER_TOKEN?.trim();
const workerId = process.env.RND_WORKER_ID?.trim() || "c9c51e78-b656-4e68-95df-82537829a59d";
const bypassSecret = (
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ??
  process.env.VERCEL_PROTECTION_BYPASS_SECRET
)?.trim();

if (!token) throw new Error("RND_WORKER_TOKEN is required");
if (!bypassSecret) throw new Error("Vercel protection bypass secret is required in the worker .env");

const url = apiBase + "/api/rnd/worker/test-enqueue";
const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-RND-Worker-Id": workerId,
    "x-vercel-protection-bypass": bypassSecret,
  },
  body: JSON.stringify({
    sourceUrl: "https://www.draftmyhair.com/portfolio/bob/french-bob-before.webp",
    promptKey: "italian-bob",
    targetKey: "m2-real-e2e-italian-bob-001",
  }),
});

const responseText = await response.text();
console.log(`HTTP ${response.status} ${response.statusText}`);
console.log(responseText);
if (!response.ok) process.exitCode = 1;
