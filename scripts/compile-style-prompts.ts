import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STYLE_ROOT = path.join(ROOT, "generation", "styles");
const OUTPUT_FILE = path.join(
  ROOT,
  "lib",
  "engine",
  "prompts",
  "styles.ts"
);

type StyleEntry = {
  id: string;
  name: string;
  prompt: string;
  source: string;
};

/**
 * Runtime prompt keys already used by the application.
 * If a matching production engine exists, the engine wins.
 * Otherwise the legacy prompt is retained as a temporary fallback.
 */
const LEGACY_FALLBACKS: Record<string, { name: string; prompt: string }> = {
  "butterfly-cut": {
    name: "Butterfly Cut",
    prompt: `Create a modern Butterfly Cut.\n\nCharacteristics:\n\n- long, cascading layers\n- face-framing pieces\n- soft crown volume\n- airy movement through the lengths\n- a polished, natural salon finish\n\nPreserve the original natural hair color unless instructed otherwise.`,
  },
  "french-bob": {
    name: "French Bob",
    prompt: `Create a classic French Bob.\n\nCharacteristics:\n\n- chin-length cut\n- soft natural volume\n- blunt baseline\n- subtle inward bend\n- clean silhouette\n- elegant Parisian finish\n\nPreserve the original natural hair color unless instructed otherwise.`,
  },
  "italian-bob": {
    name: "Italian Bob",
    prompt: `Create an Italian Bob.\n\nCharacteristics:\n\n- slightly longer than a French Bob\n- full luxurious body\n- rounded silhouette\n- polished finish\n- soft movement\n- premium salon appearance\n\nPreserve the original natural hair color unless instructed otherwise.`,
  },
  "classic-bob": {
    name: "Classic Bob",
    prompt: `Create a timeless Classic Bob.\n\nCharacteristics:\n\n- balanced proportions\n- clean perimeter\n- smooth finish\n- natural volume\n- salon precision\n\nPreserve the original natural hair color unless instructed otherwise.`,
  },
  "soft-bob": {
    name: "Soft Bob",
    prompt: `Create a Soft Bob.\n\nCharacteristics:\n\n- lightweight movement\n- soft texture\n- airy finish\n- natural volume\n- effortless appearance\n\nPreserve the original natural hair color unless instructed otherwise.`,
  },
  "long-bob": {
    name: "Long Bob",
    prompt: `Create a Long Bob (Lob).\n\nCharacteristics:\n\n- shoulder-grazing length\n- clean perimeter\n- soft layering\n- natural movement\n- elegant modern appearance\n\nPreserve the original natural hair color unless instructed otherwise.`,
  },
  "wolf-cut": {
    name: "Wolf Cut",
    prompt: `Create a modern Wolf Cut.\n\nCharacteristics:\n\n- textured, layered silhouette\n- shorter volume through the crown\n- soft face-framing fringe\n- longer, feathered lengths\n- natural movement with an editorial finish\n\nPreserve the original natural hair color unless instructed otherwise.`,
  },
  "buzz-cut": {
    name: "Buzz Cut",
    prompt: `Create a close-cropped Buzz Cut.\n\nCharacteristics:\n\n- even, short clipper length\n- clean, natural hairline\n- realistic scalp visibility\n- precise, low-maintenance silhouette\n\nPreserve the original natural hair color unless instructed otherwise.`,
  },
  bald: {
    name: "Clean Bald",
    prompt: `Create a clean shaved-head look.\n\nCharacteristics:\n\n- fully shaved scalp\n- natural scalp texture and tone\n- realistic hairline transition\n- clean, even finish\n\nPreserve the subject's facial identity, lighting, and background.`,
  },
};

const DISPLAY_NAMES: Record<string, string> = {
  butterflycut: "Butterfly Cut",
  "french-bob-with-bangs": "French Bob with Bangs",
  "soft-lob": "Soft Lob",
  "blunt-lob": "Blunt Lob",
  "sleek-back-pixie": "Sleek-Back Pixie",
  "old-money-bob": "Old Money Bob",
  "pixie-side-fringe": "Pixie with Side Fringe",
  "long-layers": "Long Layers",
  "soft-layered-bob": "Soft Layered Bob",
  "soft-layered-french-bob": "Soft Layered French Bob",
  "mid-length-layers": "Mid-Length Layers",
  bald: "Clean Bald",
  "soft-curly-pixie": "Soft Curly Pixie",
  "parisian-gamine-pixie": "Parisian Gamine Pixie",
  "mia-farrow-pixie": "Mia Farrow Pixie",
  "side-parted-textured-bixie": "Side-Parted Textured Bixie",
  "undercut-pixie": "Undercut Pixie",
  "structured-blunt-bob": "Structured Blunt Bob",
  "wolf-cut": "Wolf Cut",
  "italian-bob": "Italian Bob",
};

function slugify(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeTemplateLiteral(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

function getVersionDirectories(styleDirectory: string): string[] {
  return fs
    .readdirSync(styleDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const av = Number(a.slice(1));
      const bv = Number(b.slice(1));
      return bv - av;
    });
}

function readStyleEntries(): StyleEntry[] {
  if (!fs.existsSync(STYLE_ROOT)) {
    throw new Error(`Hairstyle directory not found:\n${STYLE_ROOT}`);
  }

  const entries: StyleEntry[] = [];

  for (const genderEntry of fs.readdirSync(STYLE_ROOT, {
    withFileTypes: true,
  })) {
    if (!genderEntry.isDirectory()) continue;

    const genderDirectory = path.join(STYLE_ROOT, genderEntry.name);

    for (const styleEntry of fs.readdirSync(genderDirectory, {
      withFileTypes: true,
    })) {
      if (!styleEntry.isDirectory()) continue;

      const styleDirectory = path.join(genderDirectory, styleEntry.name);
      const versions = getVersionDirectories(styleDirectory);
      if (versions.length === 0) continue;

      const version = versions[0];
      const styleFile = path.join(styleDirectory, version, "style.md");
      if (!fs.existsSync(styleFile)) continue;

      const prompt = fs.readFileSync(styleFile, "utf8").trim();
      if (!prompt) {
        throw new Error(`Style prompt is empty:\n${styleFile}`);
      }

      const id = slugify(styleEntry.name);

      entries.push({
        id,
        name: DISPLAY_NAMES[id] ?? titleFromSlug(id),
        prompt,
        source: path.relative(ROOT, styleFile),
      });
    }
  }

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

function buildPromptMap(entries: StyleEntry[]): Record<string, StyleEntry> {
  const map: Record<string, StyleEntry> = {};
  const compactToId = new Map<string, string>();

  for (const entry of entries) {
    map[entry.id] = entry;
    compactToId.set(entry.id.replace(/-/g, ""), entry.id);
  }

  // Preserve existing application keys where a production folder uses a
  // compact naming variant such as butterflycut -> butterfly-cut.
  for (const legacyKey of Object.keys(LEGACY_FALLBACKS)) {
    const exact = map[legacyKey];
    if (exact) continue;

    const compactMatch = compactToId.get(legacyKey.replace(/-/g, ""));
    if (compactMatch) {
      map[legacyKey] = map[compactMatch];
      continue;
    }

    // Explicitly allow a "with-bangs" production variant to satisfy the
    // existing French Bob runtime key when no exact French Bob engine exists.
    const bangsVariant = `${legacyKey}-with-bangs`;
    if (map[bangsVariant]) {
      map[legacyKey] = map[bangsVariant];
    }
  }

  return map;
}

function buildOutput(entries: StyleEntry[]): string {
  const promptMap = buildPromptMap(entries);
  const keys = new Set(Object.keys(promptMap));

  // Add legacy fallbacks only for runtime keys that do not yet have a
  // production engine. This keeps the existing application functional while
  // allowing each completed engine to replace its fallback automatically.
  for (const [id, fallback] of Object.entries(LEGACY_FALLBACKS)) {
    if (keys.has(id)) continue;
    promptMap[id] = {
      id,
      name: fallback.name,
      prompt: fallback.prompt,
      source: "legacy fallback",
    };
  }

  const ordered = Object.entries(promptMap).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const records = ordered
    .map(([key, entry]) => {
      return `  ${JSON.stringify(key)}: {\n` +
        `    id: ${JSON.stringify(entry.id)},\n` +
        `    name: ${JSON.stringify(entry.name)},\n` +
        `    prompt: \`${escapeTemplateLiteral(entry.prompt)}\`,\n` +
        `  },`;
    })
    .join("\n\n");

  const sourceComment = entries.length
    ? entries
        .map((entry) => ` * - ${entry.id}: ${entry.source}`)
        .join("\n")
    : " * - No production style engines found.";

  return `/**
 * ============================================================
 * AUTO-GENERATED FILE
 * ============================================================
 *
 * DO NOT EDIT THIS FILE.
 *
 * Source: generation/styles/**/v*/style.md
 * Generated by: npm run compile:prompts
 *
 * Production style sources:
${sourceComment}
 * ============================================================
 */

export interface StylePrompt {
  id: string;
  name: string;
  prompt: string;
}

export const STYLE_PROMPTS: Record<string, StylePrompt> = {
${records}
};
`;
}

function main(): void {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Draft My Hair Style Prompt Compiler");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const entries = readStyleEntries();
  const output = buildOutput(entries);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output, "utf8");

  console.log("");
  console.log(`✓ Production engines : ${entries.length}`);
  console.log(`✓ Output             : ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log("");
  console.log("Style prompt compilation completed successfully.");
  console.log("");
}

main();
