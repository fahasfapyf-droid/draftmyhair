import { MASTER_PROMPT } from "@/lib/engine/prompts/master";
import { MASTER_PROMPT_V2 } from "@/lib/engine/prompts/master-v2";
import { MASTER_PROMPT_V3 } from "@/lib/engine/prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "@/lib/engine/prompts/master-v3-single";

function getMasterPrompt() {
  switch ((process.env.PROMPT_VERSION?.toLowerCase() ?? "v3-single")) {
    case "v1": return MASTER_PROMPT;
    case "v2": return MASTER_PROMPT_V2;
    case "v3": return MASTER_PROMPT_V3;
    case "v3-single": return MASTER_PROMPT_V3_SINGLE;
    default: throw new Error("Unknown PROMPT_VERSION.");
  }
}

function compile(stylePrompt: string) {
  const cleanStylePrompt = stylePrompt.trim();
  if (!cleanStylePrompt) throw new Error("Authoritative hairstyle prompt is required.");

  const prompt = [
    getMasterPrompt().trim(),
    "",
    "------------------------------------------------------------",
    "",
    "# REQUESTED HAIRSTYLE",
    "",
    cleanStylePrompt,
  ].join("\n").trim();

  const master = getMasterPrompt();
  if (!master.includes("Modify only the hair.") || !master.includes("IDENTITY LOCK")) {
    throw new Error("Master prompt compilation failed.");
  }
  return prompt;
}

function appendRefinement(prompt: string, refinement: string, attemptNumber: number) {
  const escalation =
    attemptNumber >= 2
      ? [
          "This is a repeated defect from an earlier generation.",
          "Do not merely restate or subtly imply the requested correction.",
          "Make the diagnosed characteristic visually explicit and materially stronger in the generated hairstyle.",
          "Increase only the strength, clarity, or precision of that existing characteristic; do not change the haircut category, length, silhouette, or any other passing requirement.",
        ]
      : [];

  return [
    prompt,
    "",
    "------------------------------------------------------------",
    "",
    "# TARGETED REFINEMENT",
    "",
    "Change only the observed defect described below.",
    "Preserve every passing requirement from the authoritative hairstyle definition.",
    "Do not reinterpret, redesign, replace, or broaden the requested hairstyle.",
    "Do not introduce any hairstyle characteristic that is not already supported by the authoritative definition.",
    ...escalation,
    "",
    refinement.trim(),
  ].join("\n").trim();
}

/**
 * R&D prompt generation is deterministic from the authoritative hairstyle source.
 *
 * The autonomous model must not invent what a named hairstyle means. The source
 * style definition is the authority; the immutable master prompt supplies the
 * universal identity/geometry/photographic locks.
 */
export async function generateAutonomousPrompt(
  instruction: string,
  authoritativeStylePrompt: string,
) {
  const cleanInstruction = instruction.trim();
  if (!cleanInstruction) throw new Error("Human hairstyle instruction is required.");

  const prompt = compile(authoritativeStylePrompt);

  return {
    prompt,
    diagnostics: {
      source: "authoritative-style-source",
      masterPromptVersion: process.env.PROMPT_VERSION?.toLowerCase() ?? "v3-single",
      instruction: cleanInstruction,
      stylePromptLength: authoritativeStylePrompt.trim().length,
      promptLength: prompt.length,
    },
  };
}

export async function optimizeAutonomousPrompt(input: {
  instruction: string;
  currentPrompt: string;
  defect: string;
  attemptNumber: number;
  authoritativeStylePrompt: string;
}) {
  const refinement = input.defect.trim();
  if (!refinement) throw new Error("A targeted refinement defect is required.");

  const prompt = appendRefinement(
    compile(input.authoritativeStylePrompt),
    refinement,
    input.attemptNumber,
  );

  return {
    prompt,
    diagnostics: {
      source: "authoritative-style-source-refinement",
      masterPromptVersion: process.env.PROMPT_VERSION?.toLowerCase() ?? "v3-single",
      attemptNumber: input.attemptNumber,
      revisionNote: "Rebuilt from the immutable authoritative hairstyle definition and appended only the QA-targeted defect.",
      defect: refinement,
      stylePromptLength: input.authoritativeStylePrompt.trim().length,
      promptLength: prompt.length,
    },
  };
}
