# Old Money Bob — QA Specification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QA OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify that the result is a genuine Old Money Bob while preserving
identity, geometry, ears, earrings, pose, colour, and photographic
realism.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Category | Score |
|---|---:|
| Identity Preservation | |
| Face Preservation | |
| Pose Preservation | |
| Skull Geometry | |
| Ear Preservation | |
| Earring Preservation | |
| Chin-Length Accuracy | |
| Side-Part Accuracy | |
| C-Curve Accuracy | |
| Salon Finish | |
| Overall Realism | |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LENGTH CHECK — PRIMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASS:

• perimeter terminates at chin level
• no below-chin sections
• no shoulder contact
• no Lob length

FAIL:

• below-chin length
• shoulder-touching hair
• collarbone length
• uneven obvious length

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIDE-PART CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASS:

• clearly deep side part
• heavy side visibly carries more mass
• light side remains controlled
• asymmetry is intentional

FAIL:

• center part
• equal bilateral weight
• weak side sweep
• accidental-looking part

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
C-CURVE CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASS:

• both sides bend inward
• curve is strong but natural
• ends sit around chin
• no curl pattern

FAIL:

• straight ends
• outward ends
• ringlets
• excessive curl
• weak or missing inward bend

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERIMETER CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASS:

• precise
• controlled
• approximately equal termination height
• optically natural

FAIL:

• Lob drift
• obvious asymmetry
• random length
• digitally pasted ruler line

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EARRING CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If earrings are visible in the source:

• both remain visible
• position unchanged
• shape unchanged
• scale unchanged

Hair must not cover them artificially.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROWN CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASS:

• controlled height
• no puffiness
• volume driven by side sweep

FAIL:

• inflated crown
• bubble shape
• excessive width

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEXTURE CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASS:

• polished
• smooth
• controlled
• natural strand dimensionality
• realistic shine

FAIL:

• casual waves
• undone texture
• plastic shine
• artificial smoothing
• excessive flyaways

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEOMETRY CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• head position unchanged
• head tilt unchanged
• head rotation unchanged
• jaw unchanged
• chin unchanged
• neck unchanged
• ears unchanged
• framing unchanged
• crop unchanged
• zoom unchanged
• perspective unchanged

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REALISM CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The result should pass:

"Does this look like the same photograph after a high-end salon
created a luxury Old Money Bob?"

If not, identify the exact failure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCK CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Minimum production threshold:

Overall ≥ 9.4

Identity ≥ 9.5

Pose ≥ 9.5

Geometry ≥ 9.5

Length ≥ 9.5

Side Part ≥ 9.5

C-Curve ≥ 9.5

Hair Realism ≥ 9.5

If satisfied, retain v1.

If below threshold, perform ONE targeted refinement only.