import path from "node:path";
import { readFile } from "node:fs/promises";

export type GeminiProfileStatus = "ACTIVE" | "PAUSED" | "EXHAUSTED" | "RESTRICTED";
export interface GeminiProfile { id: string; label: string; directory: string; status: GeminiProfileStatus; }
interface ProfileConfig { profiles: GeminiProfile[]; }

const WORKER_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(WORKER_DIR, "../..");
const CONFIG_PATH = process.env.RND_GEMINI_PROFILES_FILE
  ? path.resolve(REPO_ROOT, process.env.RND_GEMINI_PROFILES_FILE)
  : path.resolve(WORKER_DIR, "profiles.json");

export async function loadGeminiProfiles(): Promise<GeminiProfile[]> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const config = JSON.parse(raw) as ProfileConfig;
    if (!Array.isArray(config.profiles)) throw new Error("profiles must be an array");
    return config.profiles.filter((p) => p.id && p.label && p.directory && ["ACTIVE","PAUSED","EXHAUSTED","RESTRICTED"].includes(p.status));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const fallback = process.env.RND_GEMINI_PROFILE_DIR
        ? path.resolve(REPO_ROOT, process.env.RND_GEMINI_PROFILE_DIR)
        : path.resolve(REPO_ROOT, "tools", "gemini-web-agent", "chrome-profile");
      return [{ id: "default", label: "Default Gemini profile", directory: fallback, status: "ACTIVE" }];
    }
    throw new Error(`Unable to load Gemini profile configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function selectGeminiProfile(): Promise<GeminiProfile> {
  const profiles = await loadGeminiProfiles();
  const available = profiles.find((p) => p.status === "ACTIVE");
  if (!available) throw new Error("No ACTIVE Gemini profile is configured. PAUSED/EXHAUSTED/RESTRICTED profiles require explicit operator action before reuse.");
  return { ...available, directory: path.isAbsolute(available.directory) ? available.directory : path.resolve(REPO_ROOT, available.directory) };
}

export function profileConfigPath() { return CONFIG_PATH; }
