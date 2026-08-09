# Parisian Gamine Pixie — QA Specification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QA OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify that the generated hairstyle is a genuine Parisian Gamine Pixie.

The primary classification feature is the wispy micro-fringe combined with a light, short pixie silhouette.

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
| Parisian Character | |
| Fringe Accuracy | |
| Hair Integration | |
| Texture Realism | |
| Overall Realism | |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LENGTH CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• crown approximately 2.5–3 inches
• sides softly tapered
• nape softly tapered
• nothing approaches jaw

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRINGE CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The fringe must be:

• wispy
• fine
• lightweight
• irregular
• eyebrow-level or slightly above
• partially transparent

FAIL if:

• blunt fringe
• heavy fringe
• curtain fringe
• side sweep
• dense opaque forehead coverage

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROWN CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• subtle lift
• no inflated volume
• fine strand separation
• irregular density
• natural direction

FAIL if:

• fluffy crown
• modern blowout
• sculpted styling
• geometric compression

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MIA FARROW DRIFT CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAIL if:

• crown becomes ultra-flat
• silhouette becomes extremely compact
• styling becomes overly precise
• ears become fully exposed
• haircut loses airy quality

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEXTURED CROP DRIFT CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAIL if:

• texture dominates silhouette
• strand breakup becomes editorial
• hair becomes spiky
• separation becomes chunky

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BIXIE DRIFT CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAIL if:

• lower sides become too long
• lower weight accumulates
• haircut approaches jaw length
• silhouette becomes bob-like

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REALISM CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify:

• natural root emergence
• realistic density
• natural fibre behaviour
• source lighting consistency
• source grain consistency
• photographic sharpness

Reject:

• wig effect
• painted hair
• plastic surface
• artificial symmetry
• repeated strand patterns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOCK CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Minimum:

Overall ≥ 9.4

Identity ≥ 9.5

Pose ≥ 9.5

Geometry ≥ 9.5

Haircut Accuracy ≥ 9.5

Hair Integration ≥ 9.4

If satisfied, retain v1.

If below threshold, perform ONE targeted refinement only.