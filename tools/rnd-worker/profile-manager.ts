import path from "node:path";
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export type GeminiProfileStatus = "ACTIVE" | "PAUSED" | "EXHAUSTED" | "RESTRICTED";

export interface GeminiProfile {
  id: string;
  label: string;
  directory: string;
  status: GeminiProfileStatus;
  hourlyLimit?: number;
  minIntervalMs?: number;
}

interface ProfileConfig { profiles: GeminiProfile[]; }

interface ProfileState {
  generationTimestamps: string[];
  cooldownUntil?: string;
  lastUsedAt?: string;
  lastError?: string;
  restricted?: boolean;
}

interface ProfileStateFile {
  profiles: Record<string, ProfileState>;
}

const WORKER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(WORKER_DIR, "../..");
const CONFIG_PATH = process.env.RND_GEMINI_PROFILES_FILE
  ? path.resolve(REPO_ROOT, process.env.RND_GEMINI_PROFILES_FILE)
  : path.resolve(WORKER_DIR, "profiles.json");
const STATE_PATH = process.env.RND_GEMINI_PROFILE_STATE_FILE
  ? path.resolve(REPO_ROOT, process.env.RND_GEMINI_PROFILE_STATE_FILE)
  : path.resolve(WORKER_DIR, "profile-state.json");

const DEFAULT_HOURLY_LIMIT = Number(process.env.RND_PROFILE_HOURLY_LIMIT ?? 30);
const DEFAULT_MIN_INTERVAL_MS = Number(process.env.RND_PROFILE_MIN_INTERVAL_MS ?? 120_000);
const DEFAULT_COOLDOWN_MS = Number(process.env.RND_PROFILE_COOLDOWN_MS ?? 60 * 60 * 1000);

function normalizeProfile(profile: GeminiProfile): GeminiProfile {
  return {
    ...profile,
    hourlyLimit: Number.isFinite(profile.hourlyLimit) && profile.hourlyLimit! > 0
      ? profile.hourlyLimit
      : DEFAULT_HOURLY_LIMIT,
    minIntervalMs: Number.isFinite(profile.minIntervalMs) && profile.minIntervalMs! > 0
      ? profile.minIntervalMs
      : DEFAULT_MIN_INTERVAL_MS,
  };
}

async function readState(): Promise<ProfileStateFile> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ProfileStateFile;
    return parsed && parsed.profiles ? parsed : { profiles: {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { profiles: {} };
    throw new Error(`Unable to load Gemini profile state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeState(state: ProfileStateFile) {
  const temporaryPath = `${STATE_PATH}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(state, null, 2) + "\n", "utf8");
  await rename(temporaryPath, STATE_PATH);
}

function stateFor(state: ProfileStateFile, id: string): ProfileState {
  return state.profiles[id] ?? (state.profiles[id] = { generationTimestamps: [] });
}

function prune(timestamps: string[], now: number) {
  const cutoff = now - 60 * 60 * 1000;
  return timestamps.filter((value) => Date.parse(value) >= cutoff);
}

export async function loadGeminiProfiles(): Promise<GeminiProfile[]> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const config = JSON.parse(raw) as ProfileConfig;
    if (!Array.isArray(config.profiles)) throw new Error("profiles must be an array");
    return config.profiles
      .filter((p) => p.id && p.label && p.directory && ["ACTIVE","PAUSED","EXHAUSTED","RESTRICTED"].includes(p.status))
      .map(normalizeProfile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const fallback = process.env.RND_GEMINI_PROFILE_DIR
        ? path.resolve(REPO_ROOT, process.env.RND_GEMINI_PROFILE_DIR)
        : path.resolve(REPO_ROOT, "tools", "gemini-web-agent", "chrome-profile");
      return [{ id: "default", label: "Default Gemini profile", directory: fallback, status: "ACTIVE", hourlyLimit: DEFAULT_HOURLY_LIMIT, minIntervalMs: DEFAULT_MIN_INTERVAL_MS }];
    }
    throw new Error(`Unable to load Gemini profile configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function selectGeminiProfile(): Promise<GeminiProfile> {
  const profiles = await loadGeminiProfiles();
  const state = await readState();
  const now = Date.now();

  for (const profile of profiles) {
    if (profile.status !== "ACTIVE") continue;
    const current = stateFor(state, profile.id);
    if (current.restricted) continue;
    current.generationTimestamps = prune(current.generationTimestamps, now);
    const cooldown = current.cooldownUntil ? Date.parse(current.cooldownUntil) : 0;
    if (cooldown > now) continue;
    const lastUsed = current.lastUsedAt ? Date.parse(current.lastUsedAt) : 0;
    if (lastUsed && now - lastUsed < (profile.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS)) continue;
    if (current.generationTimestamps.length >= (profile.hourlyLimit ?? DEFAULT_HOURLY_LIMIT)) continue;
    current.cooldownUntil = undefined;
    current.lastError = undefined;
    await writeState(state);
    return {
      ...profile,
      directory: path.isAbsolute(profile.directory) ? profile.directory : path.resolve(REPO_ROOT, profile.directory),
    };
  }

  throw new Error("No eligible ACTIVE Gemini profile is available. Profiles may be paused, exhausted, restricted, cooling down, or inside their generation interval.");
}

export async function markGenerationStarted(profileId: string) {
  const state = await readState();
  const current = stateFor(state, profileId);
  const now = new Date().toISOString();
  current.generationTimestamps = prune(current.generationTimestamps, Date.now());
  current.generationTimestamps.push(now);
  current.lastUsedAt = now;
  current.lastError = undefined;
  await writeState(state);
}

export async function markProfileExhausted(profileId: string, error: string) {
  const state = await readState();
  const current = stateFor(state, profileId);
  current.cooldownUntil = new Date(Date.now() + DEFAULT_COOLDOWN_MS).toISOString();
  current.lastError = error.slice(0, 1000);
  await writeState(state);
}

export async function markProfileRestricted(profileId: string, error: string) {
  const state = await readState();
  const current = stateFor(state, profileId);
  current.lastError = error.slice(0, 1000);
  current.cooldownUntil = undefined;
  current.restricted = true;
  await writeState(state);
}

export function classifyProfileError(message: string): "EXHAUSTED" | "RESTRICTED" | null {
  const value = message.toLowerCase();
  if (/(account|access|suspend|suspension|restricted|disabled|blocked|policy|violat)/i.test(value)) return "RESTRICTED";
  if (/(quota|rate.?limit|too many requests|resource exhausted|usage limit|limit reached|429)/i.test(value)) return "EXHAUSTED";
  return null;
}

export function profileConfigPath() { return CONFIG_PATH; }
export function profileStatePath() { return STATE_PATH; }
