# Side-Parted Textured Bixie — QA Specification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QA OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify that the generated hairstyle is a genuine side-parted textured bixie and not a nearby haircut category.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Category | Score |
|---|---:|
| Identity Preservation | |
| Face Preservation | |
| Pose Preservation | |
| Geometry Preservation | |
| Haircut Accuracy | |
| Bixie Classification | |
| Hair Integration | |
| Hair Color Preservation | |
| Texture Realism | |
| Overall Realism | |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BIXIE STRUCTURE CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• compact silhouette
• pixie-like proportions
• short-bob-like movement
• upper cheekbone weight
• temple weight
• lighter lower perimeter
• short nape
• natural side part

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOB DRIFT CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAIL if:

• continuous lower perimeter appears
• lower hair forms a horizontal line
• jaw-length mass accumulates
• lower sides become too heavy
• silhouette becomes rounded

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PIXIE DRIFT CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAIL if:

• sides become extremely short
• cheekbone-level weight disappears
• hairstyle becomes fully skull-hugging
• front becomes conventional pixie length

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHAG DRIFT CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAIL if:

• visible step layers appear
• texture dominates the haircut
• lower sections become highly fragmented
• silhouette becomes intentionally messy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTING CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• side part is visible
• heavier side carries slightly more weight
• asymmetry remains organic
• no exaggerated side sweep

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EAR CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify that the hair naturally follows the ear region.

FAIL if:

• ears become hidden
• ears change shape
• ears shift position
• hair is artificially cleared around the ears

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEXTURE CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Accept:

• fine strand definition
• subtle separation
• natural irregularity
• quiet movement

Reject:

• chunky texture
• repeated patterns
• excessive flyaways
• editorial styling
• plastic hair

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REALISM CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hair must:

• emerge naturally from scalp
• preserve realistic density
• preserve source lighting
• preserve source grain
• preserve source sharpness
• behave naturally under gravity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCK CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Minimum production threshold:

Overall ≥ 9.4

Identity ≥ 9.5

Pose ≥ 9.5

Geometry ≥ 9.5

Haircut Accuracy ≥ 9.5

Hair Integration ≥ 9.4

If criteria are satisfied, retain v1.

Do not refine purely for aesthetic preference.