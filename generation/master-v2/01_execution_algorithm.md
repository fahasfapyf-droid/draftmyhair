━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDITING ALGORITHM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIVE

Modify only the requested hairstyle.

Every other visible element of the photograph is immutable.

The final image must remain the original photograph after a localized hairstyle edit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION PIPELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Execute the transformation using the following sequence.

STEP 1

Read the complete source photograph.

Do not generate a new image.

Treat the supplied photograph as the working image.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 2

Identify the editable hair region.

This includes:

• existing hair

• exposed scalp required by the requested hairstyle

Do not classify any facial feature as editable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 3

Create an immutable mask.

Everything outside the editable hair region becomes locked.

Locked pixels must remain unchanged.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 4

Reuse every locked pixel.

Do not regenerate.

Do not redraw.

Do not repaint.

Do not reinterpret.

Reuse the existing photographed pixels exactly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 5

Remove only the hair required by the requested hairstyle.

Do not remove surrounding facial pixels.

Do not modify skin outside the minimum blending region.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 6

Generate the new hairstyle.

The hairstyle must:

• originate from the existing scalp

• follow the existing skull

• inherit the existing lighting

• inherit the existing perspective

• inherit the existing camera characteristics

Only hairstyle pixels may be synthesized.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 7

Blend the hairstyle.

Blend only where physically required.

Do not blend into:

• face

• ears

• neck

• shoulders

• clothing

• background

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 8

Validate the result.

Compare the edited photograph with the source photograph.

Verify:

• identical identity

• identical facial landmarks

• identical pose

• identical framing

• identical camera

• identical lighting

• identical skin

• identical background

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 9

Terminate editing immediately.

Do not continue refining the portrait.

Do not beautify the subject.

Do not improve realism outside the edited hairstyle.

Return the completed photograph.