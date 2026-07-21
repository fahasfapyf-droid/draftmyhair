# Draft My Hair — Master Prompt Library

Version: v1.0

## Purpose

The Master Prompt Library contains all universal rules that apply to every generation.

These modules are model-agnostic and independent of any specific hairstyle.

The Master Library defines **how** images should be generated.

Individual Style Blocks define **what** hairstyle should be generated.

---

# Assembly Order

The Prompt Builder must assemble the master modules in the following order:

01_identity.md

02_geometry.md

03_pose.md

04_camera.md

05_lighting.md

06_skin.md

07_hair_color.md

08_realism.md

09_negative.md

↓

Active Style Block

---

# Module Responsibilities

## 01_identity.md

Preserves the subject's identity.

## 02_geometry.md

Preserves head and body geometry.

## 03_pose.md

Preserves pose and head orientation.

## 04_camera.md

Preserves camera viewpoint, framing, crop and composition.

## 05_lighting.md

Preserves scene lighting and illumination.

## 06_skin.md

Preserves all skin characteristics.

## 07_hair_color.md

Preserves natural hair color unless an explicit color change is requested.

## 08_realism.md

Enforces photographic realism and realistic hair generation.

## 09_negative.md

Contains universal negative constraints applicable to every generation.

---

# Design Rules

• Each module has exactly one responsibility.

• Modules must not duplicate instructions.

• Modules must not reference specific hairstyles.

• Hairstyle-specific instructions belong only in Style Blocks.

• Universal behavior belongs only in the Master Library.

---

# Versioning

Each module is versioned independently.

Example:

master_v1.0

identity_v1.0

geometry_v1.0

...

Style Blocks are versioned independently.

Example:

wolf_cut_v1.0

soft_lob_v1.0

italian_bob_v1.0

---

# Goal

The Master Library should remain stable.

Future improvements should primarily occur within Style Blocks, QA, masking, and backend orchestration rather than frequent changes to the universal modules.