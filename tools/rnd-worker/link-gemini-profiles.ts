import { existsSync } from "node:fs";
import { readFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type Profile = { id: string; label: string; directory: string; status: string };
type Config = { profiles: Profile[] };

const GEMINI_URL = "https://gemini.google.com/app";
const workerDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(workerDir, "../..");
const configPath = process.env.RND_GEMINI_PROFILES_FILE
  ? path.resolve(repoRoot, process.env.RND_GEMINI_PROFILES_FILE)
  : path.resolve(workerDir, "profiles.json");
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function expandWindowsEnv(value: string) {
  return value.replace(/%([^%]+)%/g, (match, name: string) => process.env[name] ?? match);
}

if (!existsSync(configPath)) {
  throw new Error("profiles.json is missing. Run start-rnd-worker.cmd once or copy profiles.example.json to profiles.json.");
}

const config = JSON.parse(await readFile(configPath, "utf8")) as Config;
if (!Array.isArray(config.profiles) || config.profiles.length === 0) {
  throw new Error("profiles.json contains no profiles.");
}

const requestedIds = process.argv
  .slice(2)
  .filter((value) => value && value !== "--")
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean);

const profiles = requestedIds.length > 0
  ? requestedIds.map((id) => {
      const profile = config.profiles.find((candidate) => candidate.id === id);
      if (!profile) throw new Error(`Unknown Gemini profile id: ${id}`);
      return profile;
    })
  : config.profiles;

const rl = readline.createInterface({ input, output });

console.log("\n=== Draft My Hair - Gemini Profile Linker ===\n");
console.log("Each logical profile gets its own persistent Chrome user-data directory.");
console.log("Authenticate the intended Google/Gemini account in each opened window.");
console.log("Passwords and session data remain local; nothing is written to GitHub.");
if (requestedIds.length > 0) {
  console.log(`Selected profiles: ${profiles.map((profile) => profile.id).join(", ")}\n`);
} else {
  console.log("Selected profiles: all configured profiles\n");
}

try {
  for (const profile of profiles) {
    const directory = path.isAbsolute(expandWindowsEnv(profile.directory))
      ? expandWindowsEnv(profile.directory)
      : path.resolve(repoRoot, expandWindowsEnv(profile.directory));

    await mkdir(directory, { recursive: true });

    console.log(`[${profile.id}] ${profile.label}`);
    console.log(`Status: ${profile.status}`);
    console.log(`Chrome user-data-dir: ${directory}`);

    if (!existsSync(chromePath)) {
      throw new Error(`Chrome executable not found: ${chromePath}`);
    }

    const child = spawn(chromePath, [
      `--user-data-dir=${directory}`,
      GEMINI_URL,
    ], {
      detached: false,
      stdio: "ignore",
    });

    console.log("Gemini has been opened in this isolated Chrome profile.");
    await rl.question("Complete authentication, verify Gemini loads normally, close that Chrome window, then press Enter here to continue... ");
    if (!child.killed) child.kill();
    console.log();
  }
} finally {
  rl.close();
}

console.log("Gemini profile linking complete.");
console.log(`Registry: ${configPath}`);
