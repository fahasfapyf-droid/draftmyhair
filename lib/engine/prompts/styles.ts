/**
 * ============================================================
 * Draft My Hair
 * Hairstyle Prompt Library
 * ============================================================
 *
 * Each hairstyle contains ONLY instructions that are unique
 * to that hairstyle.
 *
 * Universal instructions belong in master.ts.
 */

export interface StylePrompt {
  id: string;
  name: string;
  prompt: string;
}

export const STYLE_PROMPTS: Record<string, StylePrompt> = {
  "french-bob": {
    id: "french-bob",
    name: "French Bob",
    prompt: `
Create a classic French Bob.

Characteristics:

- chin-length cut
- soft natural volume
- blunt baseline
- subtle inward bend
- clean silhouette
- elegant Parisian finish

Preserve the original natural hair color unless instructed otherwise.
`,
  },

  "italian-bob": {
    id: "italian-bob",
    name: "Italian Bob",
    prompt: `
Create an Italian Bob.

Characteristics:

- slightly longer than a French Bob
- full luxurious body
- rounded silhouette
- polished finish
- soft movement
- premium salon appearance

Preserve the original natural hair color unless instructed otherwise.
`,
  },

  "classic-bob": {
    id: "classic-bob",
    name: "Classic Bob",
    prompt: `
Create a timeless Classic Bob.

Characteristics:

- balanced proportions
- clean perimeter
- smooth finish
- natural volume
- salon precision

Preserve the original natural hair color unless instructed otherwise.
`,
  },

  "soft-bob": {
    id: "soft-bob",
    name: "Soft Bob",
    prompt: `
Create a Soft Bob.

Characteristics:

- lightweight movement
- soft texture
- airy finish
- natural volume
- effortless appearance

Preserve the original natural hair color unless instructed otherwise.
`,
  },

  "long-bob": {
    id: "long-bob",
    name: "Long Bob",
    prompt: `
Create a Long Bob (Lob).

Characteristics:

- shoulder-grazing length
- clean perimeter
- soft layering
- natural movement
- elegant modern appearance

Preserve the original natural hair color unless instructed otherwise.
`,
  },
};