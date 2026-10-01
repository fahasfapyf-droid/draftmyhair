import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.cwd(), "tools/gemini-web-agent");
const QUEUE_PATH = path.join(ROOT, "queue.json");

type Job = {
  id: string;
  imagePath: string;
  prompt: string;
  styleKey?: string;
  status: "QUEUED";
  attempts: 0;
  createdAt: string;
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string): string {
  const value = arg(name)?.trim();
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function main() {
  const imagePath = path.resolve(required("image"));
  const prompt = required("prompt");
  const styleKey = arg("style")?.trim() || undefined;

  const stat = await fs.stat(imagePath).catch(() => null);
  if (!stat?.isFile()) throw new Error(`Reference image not found: ${imagePath}`);

  let jobs: Job[] = [];
  try {
    jobs = JSON.parse(await fs.readFile(QUEUE_PATH, "utf8")) as Job[];
    if (!Array.isArray(jobs)) jobs = [];
  } catch {
    jobs = [];
  }

  const job: Job = {
    id: `rnd-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    imagePath,
    prompt,
    styleKey,
    status: "QUEUED",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  jobs.push(job);
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(QUEUE_PATH, JSON.stringify(jobs, null, 2), "utf8");
  console.log(`Queued ${job.id}`);
  console.log(`Queue: ${QUEUE_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
