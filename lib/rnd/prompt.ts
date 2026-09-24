import { buildPrompt } from "@/lib/engine/services/promptBuilder";

const UNIVERSAL_PROTECTED_PATTERNS = [
  /\bface\b/i,
  /\bfacial (?:features|identity|proportions|structure)\b/i,
  /\b(?:eyes?|eyebrows?|brows?|nose|mouth|lips?|cheeks?)\b/i,
  /\bskin(?: texture| tone| color)?\b/i,
  /\bexpression\b/i,
  /\bears?\b/i,
  /\bneck\b/i,
  /\b(?:jawline|jaw|chin|bone structure)\b/i,
  /\bskull\b/i,
  /\bhead (?:position|angle|rotation|tilt|geometry)\b/i,
  /\bpose\b/i,
  /\bbody\b/i,
  /\b(?:clothing|garment|shirt|top)\b/i,
  /\bframing\b/i,
  /\b(?:camera|perspective)\b/i,
  /\blighting\b/i,
  /\bexposure\b/i,
  /\bbackground\b/i,
  /\bcolor balance\b/i,
  /\b(?:photographic texture|pores?)\b/i,
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
  /\b(?:french|italian|micro|blunt|box|a-line|inverted) bob\b/i,
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

const CHANGE_VERBS = [
  /\b(?:add|alter|change|modify|improve|enhance|correct|fix|move|shift|reshape|regenerate|recreate|replace|remove|delete|crop|zoom|reframe|rotate|tilt|resize|widen|narrow|smooth|lighten|darken|expose|reposition)\b/i,
];

const REMOVAL_INTENT = [
  /\b(?:remove|eliminate|avoid|prevent|undo|without|no|not|do not|don't|never|exclude|suppress|reduce)\b/i,
];

function protectedModificationDetected(refinement: string) {
  const normalized = refinement.replace(/\s+/g, " ").trim();
  if (!CHANGE_VERBS.some((verb) => verb.test(normalized))) return false;

  return UNIVERSAL_PROTECTED_PATTERNS.some((protectedPattern) => {
    const match = normalized.match(protectedPattern);
    if (!match || match.index === undefined) return false;

    const windowStart = Math.max(0, match.index - 80);
    const windowEnd = Math.min(normalized.length, match.index + match[0].length + 80);
    const context = normalized.slice(windowStart, windowEnd);

    const hasPreservationLanguage =
      /\b(?:do not|don't|never|keep|preserve|maintain|leave|unchanged|locked|untouched)\b/i.test(context);

    return !hasPreservationLanguage;
  });
}

function styleFeatureIntroduced(refinement: string, authoritativePrompt: string) {
  return STYLE_INTRODUCING_PATTERNS.some((pattern) => {
    if (!pattern.test(refinement)) return false;
    if (pattern.test(authoritativePrompt)) return false;

    // A refinement may explicitly remove an unwanted feature that the
    // generator introduced, even when that feature is not part of the
    // authoritative hairstyle definition.
    const match = refinement.match(pattern);
    if (!match || match.index === undefined) return true;

    const context = refinement.slice(
      Math.max(0, match.index - 70),
      Math.min(refinement.length, match.index + match[0].length + 70),
    );

    return !REMOVAL_INTENT.some((verb) => verb.test(context));
  });
}

export function refinementAllowed(authoritativePrompt: string, refinement: string) {
  if (protectedModificationDetected(refinement)) return false;
  if (styleFeatureIntroduced(refinement, authoritativePrompt)) return false;
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
        refinementRejectionReason: "Refinement attempted to modify a universal protected region or introduce a hairstyle characteristic not present in the authoritative prompt. Removal of an observed unwanted characteristic is allowed.",
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
    "Do not introduce any new hairstyle characteristic that is not already required by the authoritative prompt.",
    "A newly introduced unwanted characteristic may only be referenced when the instruction explicitly removes, suppresses, or prevents it.",
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
