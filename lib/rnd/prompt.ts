import { buildPrompt } from "@/lib/engine/services/promptBuilder";

export async function buildRndPrompt(input: { promptKey: string; refinement?: string | null }) {
  const base = await buildPrompt({ promptKey: input.promptKey });
  const refinement = input.refinement?.trim();
  if (!refinement) return base;

  const prompt = [
    base.prompt,
    "",
    "------------------------------------------------------------",
    "",
    "# TARGETED REFINEMENT",
    "",
    "Change only the observed defect described below.",
    "Preserve every passing requirement from the original prompt.",
    "Do not reinterpret, redesign, or broaden the requested hairstyle.",
    "",
    refinement,
  ].join("\n").trim();

  return {
    prompt,
    diagnostics: {
      ...base.diagnostics,
      refinementApplied: true,
      refinementLength: refinement.length,
      finalPromptLength: prompt.length,
    },
  };
}
