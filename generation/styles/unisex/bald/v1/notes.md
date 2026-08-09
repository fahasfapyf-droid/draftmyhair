# Bald / Clean Shaved — Production Notes

Status: v1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLE DEFINITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This engine removes scalp hair and reconstructs the exposed scalp as natural human skin.

The objective is not to generate a bald-looking hairstyle.

The objective is to make the original photograph appear as though the subject had naturally shaved their head before the photograph was taken.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIMARY ARCHITECTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The transformation consists of:

HAIR REMOVAL
↓
SCALP RECONSTRUCTION
↓
SKULL-CONSISTENT LIGHTING
↓
NATURAL FOLLICLE PERCEPTION
↓
BACKGROUND RECONSTRUCTION
↓
PHOTOGRAPHIC INTEGRATION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIMARY FAILURE MODES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. GREY OVERLAY

Symptoms:

• uniform grey scalp
• artificial colour
• flat appearance

Correction:

Restore natural scalp tonality and micro-variation.

2. PLASTIC SCALP

Symptoms:

• excessive smoothing
• wax appearance
• artificial gloss

Correction:

Restore subtle human skin texture and tonal variation.

3. FOLLICLE DOTS

Symptoms:

• individual visible dots
• repetitive stippling
• noise-like texture

Correction:

Reduce follicle information to subtle tonal density.

4. SKULL DRIFT

Symptoms:

• head becomes wider
• head becomes narrower
• crown becomes rounded
• forehead geometry changes

Correction:

Restore exact source skull geometry.

5. BACKGROUND CONTAMINATION

Symptoms:

• changed background
• halo
• visible reconstruction outside hair region

Correction:

Restrict reconstruction to the removed hair region.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCALP RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The scalp is skin.

It must behave photographically like the person's existing skin, while accounting for natural scalp-specific texture and follicle density.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOLLICLE RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Follicles are perceptual information, not decorative dots.

The viewer should sense natural shaved-hair density without seeing a field of individual follicles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCK STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v1 is the initial production version.

Reproducible defects require a new version.