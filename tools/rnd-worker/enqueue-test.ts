import "./vercel-bypass.ts";

const apiBase = (process.env.RND_API_BASE ?? "https://draftmyhair-git-rnd-prompt-lab-v3-draftmyhair.vercel.app").replace(/\/$/, "");
const token = process.env.RND_WORKER_TOKEN?.trim();
const workerId = process.env.RND_WORKER_ID?.trim() || "c9c51e78-b656-4e68-95df-82537829a59d";

if (!token) throw new Error("RND_WORKER_TOKEN is required");
if (!process.env.VERCEL_AUTOMATION_BYPASS_SECRET && !process.env.VERCEL_PROTECTION_BYPASS_SECRET) {
  throw new Error("Vercel protection bypass secret is required in the worker .env");
}

const response = await fetch(apiBase + "/api/rnd/worker/test-enqueue", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-RND-Worker-Id": workerId,
  },
  body: JSON.stringify({
    sourceUrl: "https://www.draftmyhair.com/portfolio/bob/french-bob-before.webp",
    promptKey: "italian-bob",
    targetKey: "m2-real-e2e-italian-bob-001",
  }),
});

const text = await response.text();
console.log(text);
if (!response.ok) process.exitCode = 1;
