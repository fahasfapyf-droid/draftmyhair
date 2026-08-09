import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STYLE_ROOT = path.join(ROOT, "generation", "styles");
const OUTPUT_FILE = path.join(ROOT, "lib", "engine", "prompts", "styles.ts");

type StyleEntry = {
  id: string;
  name: string;
  prompt: string;
  source: string;
};

const LEGACY_FALLBACKS: Record<string, { name: string; prompt: string }> = {
  "butterfly-cut": {
    name: "Butterfly Cut",
    prompt: "Create a modern Butterfly Cut.\n\nCharacteristics:\n- long, cascading layers\n- face-framing pieces\n- soft crown volume\n- airy movement through the lengths\n- polished natural salon finish\n\nPreserve the original natural hair color unless instructed otherwise.",
  },
  "french-bob": {
    name: "French Bob",
    prompt: "Create a classic French Bob.\n\nCharacteristics:\n- chin-length cut\n- soft natural volume\n- blunt baseline\n- subtle inward bend\n- clean silhouette\n- elegant Parisian finish\n\nPreserve the original natural hair color unless instructed otherwise.",
  },
  "italian-bob": {
    name: "Italian Bob",
    prompt: "Create an Italian Bob.\n\nCharacteristics:\n- slightly longer than a French Bob\n- full luxurious body\n- rounded silhouette\n- polished finish\n- soft movement\n- premium salon appearance\n\nPreserve the original natural hair color unless instructed otherwise.",
  },
  "classic-bob": {
    name: "Classic Bob",
    prompt: "Create a timeless Classic Bob.\n\nCharacteristics:\n- balanced proportions\n- clean perimeter\n- smooth finish\n- natural volume\n- salon precision\n\nPreserve the original natural hair color unless instructed otherwise.",
  },
  "soft-bob": {
    name: "Soft Bob",
    prompt: "Create a Soft Bob.\n\nCharacteristics:\n- lightweight movement\n- soft texture\n- airy finish\n- natural volume\n- effortless appearance\n\nPreserve the original natural hair color unless instructed otherwise.",
  },
  "long-bob": {
    name: "Long Bob",
    prompt: "Create a Long Bob (Lob).\n\nCharacteristics:\n- shoulder-grazing length\n- clean perimeter\n- soft layering\n- natural movement\n- elegant modern appearance\n\nPreserve the original natural hair color unless instructed otherwise.",
  },
  "wolf-cut": {
    name: "Wolf Cut",
    prompt: "Create a modern Wolf Cut.\n\nCharacteristics:\n- textured, layered silhouette\n- shorter volume through the crown\n- soft face-framing fringe\n- longer, feathered lengths\n- natural movement with an editorial finish\n\nPreserve the original natural hair color unless instructed otherwise.",
  },
  "buzz-cut": {
    name: "Buzz Cut",
    prompt: "Create a close-cropped Buzz Cut.\n\nCharacteristics:\n- even, short clipper length\n- clean, natural hairline\n- realistic scalp visibility\n- precise, low-maintenance silhouette\n\nPreserve the original natural hair color unless instructed otherwise.",
  },
  bald: {
    name: "Clean Bald",
    prompt: "Create a clean shaved-head look.\n\nCharacteristics:\n- fully shaved scalp\n- natural scalp texture and tone\n- realistic hairline transition\n- clean, even finish\n\nPreserve the subject's facial identity, lighting, and background.",
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

function getVersionDirectories(styleDirectory: string): string[] {
  return fs
    .readdirSync(styleDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
}

function readStyleEntries(): StyleEntry[] {
  if (!fs.existsSync(STYLE_ROOT)) {
    throw new Error(`Hairstyle directory not found:\n${STYLE_ROOT}`);
  }

  const entries: StyleEntry[] = [];

  for (const genderEntry of fs.readdirSync(STYLE_ROOT, { withFileTypes: true })) {
    if (!genderEntry.isDirectory()) continue;

    const genderDirectory = path.join(STYLE_ROOT, genderEntry.name);

    for (const styleEntry of fs.readdirSync(genderDirectory, { withFileTypes: true })) {
      if (!styleEntry.isDirectory()) continue;

      const styleDirectory = path.join(genderDirectory, styleEntry.name);
      const versions = getVersionDirectories(styleDirectory);
      if (versions.length === 0) continue;

      const version = versions[0];
      const styleFile = path.join(styleDirectory, version, "style.md");
      if (!fs.existsSync(styleFile)) continue;

      const prompt = fs.readFileSync(styleFile, "utf8").trim();
      if (!prompt) throw new Error(`Style prompt is empty:\n${styleFile}`);

      const id = slugify(styleEntry.name);
      entries.push({
        id,
        name: DISPLAY_NAMES[id] ?? titleFromSlug(id),
        prompt,
        source: path.relative(ROOT, styleFile).replaceAll(path.sep, "/"),
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

  for (const legacyKey of Object.keys(LEGACY_FALLBACKS)) {
    if (map[legacyKey]) continue;

    const compactMatch = compactToId.get(legacyKey.replace(/-/g, ""));
    if (compactMatch) {
      map[legacyKey] = map[compactMatch];
      continue;
    }

    const bangsVariant = `${legacyKey}-with-bangs`;
    if (map[bangsVariant]) map[legacyKey] = map[bangsVariant];
  }

  for (const [id, fallback] of Object.entries(LEGACY_FALLBACKS)) {
    if (!map[id]) {
      map[id] = { id, name: fallback.name, prompt: fallback.prompt, source: "legacy fallback" };
    }
  }

  return map;
}

function buildOutput(entries: StyleEntry[]): string {
  const promptMap = buildPromptMap(entries);
  const ordered = Object.entries(promptMap).sort(([a], [b]) => a.localeCompare(b));

  const records = ordered
    .map(([key, entry]) =>
      `  ${JSON.stringify(key)}: {\n` +
      `    id: ${JSON.stringify(entry.id)},\n` +
      `    name: ${JSON.stringify(entry.name)},\n` +
      `    prompt: ${JSON.stringify(entry.prompt)},\n` +
      `  },`
    )
    .join("\n\n");

  const sourceComment = entries.length
    ? entries.map((entry) => ` * - ${entry.id}: ${entry.source}`).join("\n")
    : " * - No production style engines found.";

  return `/**\n * ============================================================\n * Draft My Hair\n * Compiled Hairstyle Prompt Library\n * ============================================================\n *\n * AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.\n * Source directory: generation/styles/<gender>/<style>/vX/style.md\n * Generated by: npm run compile:prompts\n *\n * Production style sources:\n${sourceComment}\n */\n\nexport interface StylePrompt {\n  id: string;\n  name: string;\n  prompt: string;\n}\n\nexport const STYLE_PROMPTS: Record<string, StylePrompt> = {\n${records}\n};\n`;
}

const entries = readStyleEntries();
const output = buildOutput(entries);

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, output, "utf8");

console.log(`Compiled ${entries.length} production hairstyle engines.`);
console.log(`Output: ${path.relative(ROOT, OUTPUT_FILE)}`);
for (const entry of entries) {
  console.log(`- ${entry.id} <- ${entry.source}`);
}
