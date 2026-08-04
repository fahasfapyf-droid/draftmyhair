━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORENSIC IMAGE EDITING CONTRACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TASK

This is a constrained photographic editing task.

A complete source photograph has already been provided.

The supplied photograph is the authoritative source for the final result.

This is NOT an image generation task.

This is NOT a portrait generation task.

This is NOT a portrait reconstruction task.

This is NOT a portrait enhancement task.

Do not generate a new portrait.

Do not recreate the photographed person.

Do not reinterpret the photographed person.

Do not synthesize an alternative version of the photographed person.

The objective is to perform a localized photographic edit that modifies only the requested hairstyle.

The final image must remain the exact same photograph with only the hairstyle changed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTHORITATIVE SOURCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The uploaded photograph is the single source of truth.

The original photograph has priority over all learned visual priors.

The original photograph has priority over aesthetic preferences.

The original photograph has priority over statistical expectations.

The original photograph has priority over model assumptions.

If any conflict exists between the requested hairstyle and the supplied photograph,

preserve the photograph,

modify only the hairstyle.

Never replace the original photograph with a visually similar reconstruction.

Never create another version of the person.

Treat the supplied photograph as the master reference throughout the entire editing process.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDITING WORKFLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before making any modification:

1. Analyse the complete photograph.

2. Identify the editable hair region.

3. Identify every immutable region.

4. Lock every immutable region.

5. Freeze all immutable pixels.

6. Perform a localized hairstyle edit.

7. Compare the edited photograph against the source photograph.

8. Verify every immutable region remains identical.

Only after every verification step succeeds may the edit be considered complete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDITABLE REGION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only the subject's hair system is editable.

This includes:

• Hair strands

• Hair roots

• Hair density

• Hair length

• Hair layering

• Hair direction

• Hair texture

• Hair parting

• Hair silhouette

If the requested hairstyle naturally exposes previously hidden scalp,

only the newly visible scalp required for that hairstyle may also be modified.

Small neighbouring pixels may be adjusted only where physically required for seamless strand integration.

No intentional modification may extend beyond the minimum area required for natural hair integration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMMUTABLE REGION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Everything outside the editable hair region is immutable.

These regions are authoritative.

They must remain visually identical to the supplied photograph.

This includes:

• Facial identity

• Skull geometry

• Face shape

• Facial proportions

• Facial landmarks

• Head size

• Head position

• Head rotation

• Camera viewpoint

• Camera distance

• Camera perspective

• Camera angle

• Camera height

• Subject scale

• Crop

• Framing

• Composition

• Eyes

• Eyebrows

• Eyelashes

• Nose

• Lips

• Teeth

• Ears

• Jawline

• Chin

• Neck

• Shoulders

• Body posture

• Clothing

• Accessories

• Background

• Lighting

• Shadows

• Exposure

• White balance

• Colour grading

• Camera grain

• Noise

• Sharpness

• Skin

• Skin colour

• Skin texture

• Skin pores

• Freckles

• Wrinkles

• Fine lines

• Makeup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE REGISTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The edited photograph must register perfectly with the supplied photograph.

Outside the editable hair region,

every visible structure must occupy identical image coordinates.

If both photographs are overlaid,

all facial features,

all body features,

all clothing,

all background features,

all image borders,

must align perfectly.

If perfect registration cannot be achieved,

discard the edit.

Preserve the original photograph.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PIXEL PRESERVATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Outside the editable hair region,

existing photographic pixels are authoritative.

Do not regenerate them.

Do not redraw them.

Do not repaint them.

Do not reinterpret them.

Do not replace them with visually similar approximations.

Reuse the existing photographic information.

Only pixels belonging to the editable hair region may be synthesized.

The hairstyle must be integrated into the existing photograph.

The photograph must never be regenerated around the hairstyle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCALITY CONSTRAINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The edit must remain spatially local.

Modification may propagate only as far as physically required for natural hair integration.

Hair editing must never trigger reconstruction of:

• facial identity

• facial anatomy

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

• generate a new face

• reconstruct facial identity

• reconstruct the portrait

• reconstruct the photograph

• regenerate the subject

• change facial geometry

• change skull geometry

• change head position

• change head rotation

• change camera viewpoint

• change camera distance

• change perspective

• change crop

• change zoom

• change subject scale

• change pose

• change facial expression

• change gaze direction

• change skin appearance

• change skin texture

• change skin tone

• change clothing

• change accessories

• change background

• change lighting

• globally regenerate the image

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STOP CONDITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Editing is complete once:

• the requested hairstyle has been naturally integrated

• every immutable region remains visually identical

• image registration remains perfect

• no further modifications are required

Do not continue improving realism outside the editable hair region.

Do not continue improving identity.

Do not continue refining the portrait.

Stop immediately after the hairstyle has been successfully integrated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A successful result appears to be the exact same photograph captured immediately after the subject received a professional haircut.

Identity is unchanged.

Geometry is unchanged.

Pose is unchanged.

Camera is unchanged.

Framing is unchanged.

Lighting is unchanged.

Every non-hair pixel remains visually consistent with the original photograph.

The only intentional visual difference is the requested hairstyle.