import { buildPrompt } from "@/lib/engine/services/promptBuilder";

const UNIVERSAL_PROTECTED_PATTERNS = [
  /\bface\b/i,
  /\bfacial\b/i,
  /\bskin\b/i,
  /\bexpression\b/i,
  /\bears?\b/i,
  /\bneck\b/i,
  /\bjawline\b/i,
  /\bskull\b/i,
  /\bhead (position|angle|rotation|tilt)\b/i,
  /\bpose\b/i,
  /\bbody\b/i,
  /\bframing\b/i,
  /\bcamera\b/i,
  /\bperspective\b/i,
  /\blighting\b/i,
  /\bexposure\b/i,
  /\bbackground\b/i,
  /\bcolor balance\b/i,
  /\bphotographic texture\b/i,
];

const STYLE_INTRODUCING_PATTERNS = [
  /\b(?:deep |soft |hard )?side part\b/i,
  /\bmiddle part\b/i,
  /\bcenter part\b/i,
  /\bbangs?\b/i,
  /\bfringe\b/i,
  /\bcurtain bangs?\b/i,
  /\bforehead sweep\b/i,
  /\b(?:tuck|tucked|tucking) (?:behind|under) (?:the )?ears?\b/i,
  /\blayers?\b/i,
  /\blayering\b/i,
  /\bshag\b/i,
  /\bwolf cut\b/i,
  /\bmullet\b/i,
  /\bpixie\b/i,
  /\blob\b/i,
  /\bbob\b/i,
  /\bunder(?:cut|shave)\b/i,
  /\b(?:skin )?fade\b/i,
  /\btaper\b/i,
  /\bshaved?\b/i,
  /\bbraids?\b/i,
  /\bponytail\b/i,
  /\bupdo\b/i,
  /\bcurls?\b/i,
  /\bwaves?\b/i,
];

function refinementAllowed(authoritativePrompt: string, refinement: string) {
  if (UNIVERSAL_PROTECTED_PATTERNS.some((pattern) => pattern.test(refinement))) return false;

  for (const pattern of STYLE_INTRODUCING_PATTERNS) {
    const match = refinement.match(pattern);
    if (match && !pattern.test(authoritativePrompt)) return false;
  }

  return true;
}

export async function buildRndPrompt(input: {
  prompt?: string;
  promptKey?: string;
  refinement?: string | null;
}) {
  const base = input.prompt
    ? { prompt: input.prompt, diagnostics: { promptSource: "existing-attempt" as const } }
    : input.promptKey
      ? await buildPrompt({ promptKey: input.promptKey })
      : (() => { throw new Error("prompt or promptKey is required"); })();

  const refinement = input.refinement?.trim();
  if (!refinement) return base;

  if (!refinementAllowed(base.prompt, refinement)) {
    return {
      prompt: base.prompt,
      diagnostics: {
        ...base.diagnostics,
        refinementApplied: false,
        refinementRejected: true,
        refinementRejectionReason: "Refinement attempted to modify a universal protected region or introduce a hairstyle characteristic not present in the authoritative prompt.",
        refinementLength: refinement.length,
        finalPromptLength: base.prompt.length,
      },
    };
  }

  const prompt = [
    base.prompt,
    "",
    "------------------------------------------------------------",
    "",
    "# TARGETED REFINEMENT",
    "",
    "AUTHORITATIVE PROMPT ABOVE IS IMMUTABLE.",
    "Apply only the single observed defect below.",
    "Preserve every passing requirement from the authoritative prompt.",
    "Do not reinterpret, redesign, replace, or broaden the requested hairstyle.",
    "Do not modify identity, facial features, skin, expression, ears, head/skull geometry, pose, framing, camera perspective, lighting, background, or any other non-hair region.",
    "",
    refinement,
  ].join("\n").trim();

  return {
    prompt,
    diagnostics: {
      ...base.diagnostics,
      refinementApplied: true,
      refinementRejected: false,
      refinementLength: refinement.length,
      finalPromptLength: prompt.length,
    },
  };
}
