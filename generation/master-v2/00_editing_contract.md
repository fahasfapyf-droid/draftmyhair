━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORENSIC IMAGE EDITING CONTRACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCTION PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When instructions conflict, obey them in this order.

Priority 1
Preserve the photographed person's identity.

Priority 2
Preserve every immutable pixel.

Priority 3
Preserve camera geometry and photographic continuity.

Priority 4
Apply the requested hairstyle.

Priority 5
Improve realism only inside the editable hair region.

Never violate a higher-priority rule to satisfy a lower-priority rule.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is a constrained photographic editing task.

A complete source photograph has already been provided.

This is NOT:

• image generation

• portrait generation

• portrait reconstruction

• portrait enhancement

• identity synthesis

The uploaded photograph is the only authoritative representation of the photographed person.

Do not generate, recreate, reconstruct, reinterpret, or synthesize another portrait.

Modify only the hairstyle.

The completed result must remain the same photograph after a localized hairstyle edit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTHORITATIVE SOURCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The uploaded photograph is the single source of truth.

Whenever an instruction conflicts with the photographed appearance:

Preserve the photograph.

Modify only the hairstyle.

Never replace the photograph with a statistically similar reconstruction.

The photograph has authority over:

• learned priors

• inferred anatomy

• aesthetic preferences

• statistical expectations

• model assumptions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDITING ALGORITHM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Execute the edit using this sequence.

1.

Load the supplied photograph.

Treat it as the working image.

Do not generate a new photograph.

2.

Identify the editable hair region.

Only hairstyle pixels may be modified.

3.

Lock every pixel outside the editable hair region.

These pixels become immutable.

4.

Reuse immutable pixels exactly.

Do not regenerate.

Do not redraw.

Do not repaint.

Do not reinterpret.

Do not synthesize replacement pixels.

5.

Generate only the requested hairstyle.

Hair must emerge naturally from the photographed scalp.

6.

Blend the hairstyle only where physically required.

Do not expand the edit beyond the minimum blending region.

7.

Compare the edited photograph against the original photograph.

8.

Validate every immutable region.

If validation fails:

Discard the edit.

Restart from the original photograph.

9.

Return the completed photograph immediately.

Do not continue refining immutable regions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDITABLE REGION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only the hairstyle is editable.

Editable elements include:

• strands

• roots

• density

• layering

• texture

• silhouette

• direction

• parting

Modify scalp only where physically required for natural integration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMMUTABLE REGION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Everything outside the editable hair region is immutable.

Preserve exactly:

• facial identity

• skull geometry

• facial proportions

• facial landmarks

• head position

• head rotation

• subject scale

• camera viewpoint

• camera distance

• perspective

• framing

• crop

• composition

• eyes

• eyebrows

• eyelashes

• nose

• lips

• teeth

• ears

• jawline

• chin

• neck

• shoulders

• clothing

• accessories

• background

• lighting

• exposure

• white balance

• shadows

• colour grading

• camera grain

• image noise

• sharpness

• skin

• pores

• wrinkles

• freckles

• blemishes

• makeup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PIXEL AUTHORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every pixel outside the editable hair region is authoritative.

Reuse photographed pixels whenever physically possible.

Never synthesize replacement pixels outside the editable region.

Only hairstyle pixels may be synthesized.

The hairstyle adapts to the photograph.

The photograph never adapts to the hairstyle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE REGISTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The edited photograph must register perfectly with the original photograph.

Every immutable structure must occupy identical image coordinates.

This includes:

• face

• body

• clothing

• background

• image borders

If perfect registration cannot be maintained:

Reject the edit.

Preserve the original photograph.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCALITY CONSTRAINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The edit must remain spatially local.

Only the minimum number of pixels required for natural hair integration may change.

Hair editing must never trigger reconstruction of:

• facial identity

• anatomy

• body posture

• camera geometry

• perspective

• framing

• crop

• zoom

• lighting

• composition

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORBIDDEN OPERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Never:

• generate a new portrait

• generate a new face

• regenerate the photograph

• reconstruct the subject

• modify identity

• modify skull geometry

• modify pose

• modify expression

• modify gaze

• modify camera position

• modify perspective

• modify framing

• modify crop

• modify zoom

• modify subject scale

• modify skin

• modify clothing

• modify accessories

• modify background

• modify lighting

• perform global image regeneration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STOP CONDITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Terminate editing immediately when:

• the requested hairstyle has been integrated

• immutable regions remain unchanged

• image registration is preserved

Do not continue improving realism outside the editable hair region.

Do not beautify the subject.

Do not continue refining identity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Accept the edit only if:

✓ Identity unchanged

✓ Geometry unchanged

✓ Camera unchanged

✓ Lighting unchanged

✓ Background unchanged

✓ Every immutable pixel remains visually consistent

✓ The requested hairstyle is the only intentional visual difference