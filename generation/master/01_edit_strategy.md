MODULE: 05_edit_strategy.md

────────────────────────────────────
EDITING STRATEGY
────────────────────────────────────

This is an image editing task.

It is NOT an image generation task.

An existing real photograph has already been provided.

The photograph already contains the correct:

• subject
• face
• head
• skull
• pose
• camera position
• perspective
• lighting
• expression
• body
• clothing
• background

These elements already exist and must remain the foundation of the final image.

Never replace the photograph with a newly generated portrait.

The final image must remain the original photograph after localized hair editing.

────────────────────────────────────
EDITING PIPELINE
────────────────────────────────────

Perform the transformation using this exact sequence.

Step 1

Read the existing photograph.
Create an immutable mask for every non-hair pixel before editing begins.

Step 2

Identify pixels belonging to existing hair.

Step 3

Preserve every pixel outside the editable hair region.

Step 4

Remove only the hair required for the requested hairstyle.

Step 5

Construct the new hairstyle directly on the existing scalp.

Step 6

Blend the hairstyle naturally into the existing photograph.

Step 7

Stop editing.

Do not regenerate the portrait at any point during this process.

────────────────────────────────────
SOURCE PHOTOGRAPH
────────────────────────────────────

The source photograph is authoritative.

Assume every visible facial feature is already correct.

Assume every visible anatomical measurement is already correct.

Assume every visible proportion is already correct.

Do not improve the subject.

Do not beautify the subject.

Do not reinterpret the subject.

Do not optimize the subject.

The goal is not to create a better portrait.

The goal is to preserve the original portrait while changing only the hairstyle.

────────────────────────────────────
HAIR REPLACEMENT
────────────────────────────────────

Treat the hairstyle as a localized replacement.

The new hairstyle must be attached to the existing scalp.

Hair roots originate from the subject's existing follicles.

Hair follows the existing skull.

Hair follows the existing scalp curvature.

Hair follows the existing head dimensions.

Never create a new skull.

Never create a new forehead.

Never reposition the scalp.

Never reposition the hairline unless explicitly required by the requested hairstyle.

────────────────────────────────────
PIXEL OWNERSHIP
────────────────────────────────────

Every visible pixel belongs to one region.

Region A

Hair

Editable.

Region B

Face

Immutable.

Region C

Neck

Immutable.

Region D

Ears

Immutable.

Region E

Body

Immutable.

Region F

Clothing

Immutable.

Region G

Background

Immutable.

Only Region A may be modified.

No other region may be regenerated.

────────────────────────────────────
LOCALIZED EDITING
────────────────────────────────────

Hair editing must remain spatially localized.

The model must never perform whole-image reconstruction.

The model must never regenerate the complete portrait.

Only replace pixels that are necessary for the hairstyle transformation.

Everything else remains untouched.

The edited photograph should appear identical to the source photograph except for the hairstyle.

────────────────────────────────────
HEAD GEOMETRY
────────────────────────────────────

The skull is fixed.

The head is fixed.

The camera is fixed.

The pose is fixed.

The perspective is fixed.

The hairstyle must adapt to the existing head.

The head must never adapt to the hairstyle.

────────────────────────────────────
TERMINATION CONDITION
────────────────────────────────────

When the hairstyle has been successfully integrated into the existing photograph, terminate editing immediately.

Do not continue modifying facial anatomy.

Do not continue refining identity.

Do not continue improving realism outside the edited hair region.

Editing is complete once the requested hairstyle has been naturally integrated into the original photograph.